import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import { ClientConfig } from '../types'
import { getClientConfigDir } from '../runtimePaths'
import { makeDataverseClient, validateEnvironmentUrl } from '../auth'
import { checkOptionSets, restoreOptionSets } from '../optionsets'
import { parsePastedContent, comparePastedWithDev } from '../pastecompare'
import { recordAuditEvent } from '../audit'

export const optionSetsRouter = Router()

const CONFIG_DIR = getClientConfigDir()

function loadClientConfig(environmentUrl: string): ClientConfig | null {
  if (!fs.existsSync(CONFIG_DIR)) return null
  const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'))
  const normalised = environmentUrl.replace(/\/$/, '').toLowerCase()
  for (const file of files) {
    const config: ClientConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf-8'))
    if (config.environmentUrl.replace(/\/$/, '').toLowerCase() === normalised) return config
  }
  return null
}

optionSetsRouter.get('/status', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  const config = loadClientConfig(environmentUrl)
  if (!config) {
    res.status(404).json({ error: 'No client config found for this environment' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const sourceClient = config.sourceOfTruthUrl
      ? await makeDataverseClient(config.sourceOfTruthUrl)
      : client
    const results = await checkOptionSets(client, config, sourceClient)
    res.json({ clientName: config.name, sourceOfTruth: config.sourceOfTruthUrl ?? environmentUrl, results })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

optionSetsRouter.post('/restore', async (req: Request, res: Response) => {
  const { environmentUrl, safetyAcknowledged } = req.body
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl is required' })
    return
  }
  if (safetyAcknowledged !== true) {
    res.status(400).json({ error: 'Safety acknowledgement is required before restoring option set values.' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  const config = loadClientConfig(environmentUrl)
  if (!config) {
    res.status(404).json({ error: 'No client config found for this environment' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    const sourceClient = config.sourceOfTruthUrl
      ? await makeDataverseClient(config.sourceOfTruthUrl)
      : client
    const result = await restoreOptionSets(client, config, sourceClient)
    recordAuditEvent({
      action: 'option_set_restore',
      targetSystem: 'Dataverse',
      target: environmentUrl,
      status: 'success',
      summary: `Restored ${result.restored} option set value(s) for ${config.name}.`,
      metadata: {
        clientName: config.name,
        sourceOfTruth: config.sourceOfTruthUrl ?? environmentUrl,
        restored: result.restored,
        failed: result.failed,
      },
    })
    res.json({ clientName: config.name, ...result })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    recordAuditEvent({
      action: 'option_set_restore',
      targetSystem: 'Dataverse',
      target: environmentUrl,
      status: 'failure',
      summary: detail,
      metadata: { clientName: config.name },
    })
    res.status(500).json({ error: detail })
  }
})

optionSetsRouter.get('/doc-vs-dev', async (req: Request, res: Response) => {
  const { environmentUrl } = req.query
  if (!environmentUrl || typeof environmentUrl !== 'string') {
    res.status(400).json({ error: 'environmentUrl query param is required' })
    return
  }
  try { validateEnvironmentUrl(environmentUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  const config = loadClientConfig(environmentUrl)
  if (!config) {
    res.status(404).json({ error: 'No client config found for this environment' })
    return
  }
  try {
    const client = await makeDataverseClient(environmentUrl)
    // Always compare config (doc) values against the live environment — no source client
    const results = await checkOptionSets(client, config)
    res.json({ clientName: config.name, environmentUrl, results })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

optionSetsRouter.post('/compare', async (req: Request, res: Response) => {
  const { sourceUrl, targetUrl } = req.body
  if (!sourceUrl || !targetUrl || typeof sourceUrl !== 'string' || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'sourceUrl and targetUrl are required' })
    return
  }
  try { validateEnvironmentUrl(sourceUrl); validateEnvironmentUrl(targetUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  
  const sourceConfig = loadClientConfig(sourceUrl)
  const targetConfig = loadClientConfig(targetUrl)
  
  if (!sourceConfig || !targetConfig) {
    res.status(404).json({ error: 'No client config found for one or both environments' })
    return
  }
  
  try {
    const sourceClient = await makeDataverseClient(sourceUrl)
    const targetClient = await makeDataverseClient(targetUrl)
    
    const sourceResults = await checkOptionSets(sourceClient, sourceConfig)
    const targetResults = await checkOptionSets(targetClient, targetConfig)
    
    // Compare results
    const differences = sourceResults.map(sourceResult => {
      const targetResult = targetResults.find(tr => tr.displayName === sourceResult.displayName)
      
      if (!targetResult) {
        return {
          displayName: sourceResult.displayName,
          type: sourceResult.type,
          sourceOnly: sourceResult.values,
          targetOnly: [],
          different: []
        }
      }
      
      const sourceValues = new Map(sourceResult.values.map(v => [v.value, v.currentLabel]))
      const targetValues = new Map(targetResult.values.map(v => [v.value, v.currentLabel]))
      
      const sourceOnly = sourceResult.values.filter(v => !targetValues.has(v.value))
      const targetOnly = targetResult.values.filter(v => !sourceValues.has(v.value))
      const different = sourceResult.values.filter(v => {
        const targetLabel = targetValues.get(v.value)
        return targetLabel && targetLabel !== v.currentLabel
      }).map(v => ({
        value: v.value,
        sourceLabel: v.currentLabel,
        targetLabel: targetValues.get(v.value)
      }))
      
      return {
        displayName: sourceResult.displayName,
        type: sourceResult.type,
        sourceOnly,
        targetOnly,
        different
      }
    })
    
    res.json({
      sourceName: sourceConfig.name,
      targetName: targetConfig.name,
      differences
    })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

optionSetsRouter.post('/paste-compare', async (req: Request, res: Response) => {
  const { pastedText, devUrl } = req.body
  if (!pastedText || !devUrl || typeof devUrl !== 'string') {
    res.status(400).json({ error: 'pastedText and devUrl are required' })
    return
  }
  try { validateEnvironmentUrl(devUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }

  const devConfig = loadClientConfig(devUrl)
  if (!devConfig) {
    res.status(404).json({ error: 'No client config found for the dev environment URL' })
    return
  }

  const tables = parsePastedContent(pastedText)
  if (tables.length === 0) {
    res.status(422).json({
      error: 'No option set tables found in the pasted content. Make sure you copied a table with a numeric Value column and a Label column.',
    })
    return
  }

  try {
    const devClient = await makeDataverseClient(devUrl)
    const results = await comparePastedWithDev(tables, devClient, devConfig)
    const availableOptionSets = devConfig.optionSets.map(os => os.displayName)
    const parsedTitles = tables.map(t => t.title || '(untitled)')
    res.json({ devName: devConfig.name, tablesFound: tables.length, parsedTitles, availableOptionSets, results })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})
