import { Router, Request, Response } from 'express'
import { isConfigured, saveConfig, applyConfig, generateApiKey, VantageConfig } from '../config'

export const setupRouter = Router()

setupRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: isConfigured() })
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
