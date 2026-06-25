import { Router, Request, Response } from 'express'
import {
  isConfigured,
  saveConfig,
  applyConfig,
  loadSavedConfig,
  resetSavedConfig,
  VantageConfig,
} from '../config'

export const setupRouter = Router()
export const settingsRouter = Router()

setupRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: isConfigured() })
})

settingsRouter.get('/current', (_req: Request, res: Response) => {
  const mask = (value: string | undefined) =>
    value ? `${value.slice(0, 4)}${'•'.repeat(Math.max(0, value.length - 8))}${value.slice(-4)}` : ''

  res.json({
    azureTenantId: process.env.AZURE_TENANT_ID ?? '',
    azureClientId: process.env.AZURE_CLIENT_ID ?? '',
    azureClientSecretMasked: mask(process.env.AZURE_CLIENT_SECRET),
    azureDevOpsPatMasked: mask(process.env.AZURE_DEVOPS_PAT),
    hasDevOpsPat: Boolean(process.env.AZURE_DEVOPS_PAT?.trim()),
    hasGroqApiKey: Boolean(process.env.GROQ_API_KEY?.trim()),
    aiDataConsent: process.env.AI_DATA_CONSENT === 'true',
  })
})

settingsRouter.post('/update', (req: Request, res: Response) => {
  const saved = loadSavedConfig()
  if (!saved) {
    res.status(400).json({ error: 'Not configured yet.' })
    return
  }

  const {
    azureTenantId,
    azureClientId,
    azureClientSecret,
    azureDevOpsPat,
    aiDataConsent,
  } = req.body

  const updated: VantageConfig = {
    ...saved,
    ...(azureTenantId?.trim() ? { AZURE_TENANT_ID: azureTenantId.trim() } : {}),
    ...(azureClientId?.trim() ? { AZURE_CLIENT_ID: azureClientId.trim() } : {}),
    ...(azureClientSecret?.trim() ? { AZURE_CLIENT_SECRET: azureClientSecret.trim() } : {}),
    ...(azureDevOpsPat?.trim() ? { AZURE_DEVOPS_PAT: azureDevOpsPat.trim() } : {}),
    ...(typeof aiDataConsent === 'boolean' ? { AI_DATA_CONSENT: aiDataConsent } : {}),
  }

  saveConfig(updated)
  applyConfig(updated)
  res.json({ success: true })
})

settingsRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    resetSavedConfig()
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

  const {
    azureTenantId,
    azureClientId,
    azureClientSecret,
    azureDevOpsPat,
    aiDataConsent,
  } = req.body

  if (!azureTenantId?.trim() || !azureClientId?.trim() || !azureClientSecret?.trim()) {
    res.status(400).json({ error: 'Tenant ID, Client ID, and Client Secret are required.' })
    return
  }

  const config: VantageConfig = {
    AZURE_TENANT_ID: azureTenantId.trim(),
    AZURE_CLIENT_ID: azureClientId.trim(),
    AZURE_CLIENT_SECRET: azureClientSecret.trim(),
    ...(azureDevOpsPat?.trim() ? { AZURE_DEVOPS_PAT: azureDevOpsPat.trim() } : {}),
    AI_DATA_CONSENT: aiDataConsent === true,
  }

  saveConfig(config)
  applyConfig(config)
  res.json({ success: true })
})
