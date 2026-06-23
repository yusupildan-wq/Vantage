import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const CONFIG_PATH = path.join(__dirname, '../../data/config.json')

export interface VantageConfig {
  AZURE_TENANT_ID: string
  AZURE_CLIENT_ID: string
  AZURE_CLIENT_SECRET: string
  API_KEY: string
  AZURE_DEVOPS_PAT?: string
}

export function loadSavedConfig(): VantageConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as VantageConfig
  } catch {
    return null
  }
}

export function saveConfig(config: VantageConfig): void {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function applyConfig(config: VantageConfig): void {
  process.env.AZURE_TENANT_ID = config.AZURE_TENANT_ID
  process.env.AZURE_CLIENT_ID = config.AZURE_CLIENT_ID
  process.env.AZURE_CLIENT_SECRET = config.AZURE_CLIENT_SECRET
  process.env.API_KEY = config.API_KEY
  if (config.AZURE_DEVOPS_PAT) process.env.AZURE_DEVOPS_PAT = config.AZURE_DEVOPS_PAT
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function isConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.API_KEY
  )
}
