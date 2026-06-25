import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { isConfigured, saveConfig, applyConfig, generateApiKey, loadSavedConfig, VantageConfig } from '../config'

export const setupRouter = Router()

setupRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: isConfigured() })
})

// GET /setup/current — return masked current credential values for the settings page
setupRouter.get('/current', (_req: Request, res: Response) => {
  const mask = (v: string | undefined) => v ? `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 8))}${v.slice(-4)}` : ''
  res.json({
    azureTenantId: process.env.AZURE_TENANT_ID ?? '',
    azureClientId: process.env.AZURE_CLIENT_ID ?? '',
    azureClientSecretMasked: mask(process.env.AZURE_CLIENT_SECRET),
    azureDevOpsPatMasked: mask(process.env.AZURE_DEVOPS_PAT),
    hasDevOpsPat: !!(process.env.AZURE_DEVOPS_PAT?.trim()),
  })
})

// POST /setup/update — update one or more credential fields
setupRouter.post('/update', (req: Request, res: Response) => {
  const saved = loadSavedConfig()
  if (!saved) { res.status(400).json({ error: 'Not configured yet.' }); return }

  const { azureTenantId, azureClientId, azureClientSecret, azureDevOpsPat } = req.body

  const updated: VantageConfig = {
    ...saved,
    ...(azureTenantId?.trim()     ? { AZURE_TENANT_ID:     azureTenantId.trim() }     : {}),
    ...(azureClientId?.trim()     ? { AZURE_CLIENT_ID:     azureClientId.trim() }     : {}),
    ...(azureClientSecret?.trim() ? { AZURE_CLIENT_SECRET: azureClientSecret.trim() } : {}),
    ...(azureDevOpsPat?.trim()    ? { AZURE_DEVOPS_PAT:    azureDevOpsPat.trim() }    : {}),
  }

  saveConfig(updated)
  applyConfig(updated)
  res.json({ success: true })
})

// POST /setup/reset — wipe saved config and force re-setup on next launch
setupRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    const dataDir = (process as any).pkg
      ? path.join(path.dirname(process.execPath), 'data')
      : path.join(__dirname, '../../../data')
    const configPath = path.join(dataDir, 'config.json')
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to reset' })
  }
})

setupRouter.post('/save', (req: Request, res: Response) => {
  if (isConfigured()) {
    res.status(409).json({ error: 'Already configured.' })
    return
  }

  const { azureTenantId, azureClientId, azureClientSecret, azureDevOpsPat } = req.body

  if (!azureTenantId?.trim() || !azureClientId?.trim() || !azureClientSecret?.trim()) {
    res.status(400).json({ error: 'Tenant ID, Client ID, and Client Secret are required.' })
    return
  }

  const config: VantageConfig = {
    AZURE_TENANT_ID: azureTenantId.trim(),
    AZURE_CLIENT_ID: azureClientId.trim(),
    AZURE_CLIENT_SECRET: azureClientSecret.trim(),
    API_KEY: generateApiKey(),
    ...(azureDevOpsPat?.trim() ? { AZURE_DEVOPS_PAT: azureDevOpsPat.trim() } : {}),
  }

  saveConfig(config)
  applyConfig(config)

  res.json({ success: true })
})
