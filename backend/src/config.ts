import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// When running as a pkg standalone exe, store data next to the exe on the real filesystem.
// __dirname inside pkg points to the virtual snapshot, not the disk.
export function getDataDir(): string {
  if (process.env.VANTAGE_DATA_DIR?.trim()) return path.resolve(process.env.VANTAGE_DATA_DIR.trim())
  if ((process as any).pkg) return path.join(path.dirname(process.execPath), 'data')
  return path.join(__dirname, '../../data')
}

const DATA_DIR = getDataDir()
const LEGACY_CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const CONFIG_PATH = path.join(DATA_DIR, 'config.enc.json')
const KEY_PATH = path.join(DATA_DIR, 'config.key')

export interface VantageConfig {
  AZURE_TENANT_ID: string
  AZURE_CLIENT_ID: string
  AZURE_CLIENT_SECRET: string
  API_KEY?: string
  AZURE_DEVOPS_PAT?: string
  GROQ_API_KEY?: string
  AI_DATA_CONSENT?: boolean
}

interface EncryptedConfig {
  version: 1
  iv: string
  authTag: string
  ciphertext: string
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
}

function loadOrCreateKey(): Buffer {
  ensureDataDir()
  if (fs.existsSync(KEY_PATH)) {
    const key = Buffer.from(fs.readFileSync(KEY_PATH, 'utf8').trim(), 'base64')
    if (key.length !== 32) throw new Error('Invalid credential encryption key.')
    return key
  }
  const key = crypto.randomBytes(32)
  fs.writeFileSync(KEY_PATH, key.toString('base64'), { encoding: 'utf8', mode: 0o600 })
  return key
}

export function encryptConfig(config: VantageConfig, key: Buffer): EncryptedConfig {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()])
  return {
    version: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function decryptConfig(envelope: EncryptedConfig, key: Buffer): VantageConfig {
  if (envelope.version !== 1) throw new Error('Unsupported credential file version.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(plaintext.toString('utf8')) as VantageConfig
}

export function loadSavedConfig(): VantageConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const envelope = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as EncryptedConfig
      return decryptConfig(envelope, loadOrCreateKey())
    }
    if (!fs.existsSync(LEGACY_CONFIG_PATH)) return null
    const legacy = JSON.parse(fs.readFileSync(LEGACY_CONFIG_PATH, 'utf8')) as VantageConfig
    saveConfig(legacy)
    fs.unlinkSync(LEGACY_CONFIG_PATH)
    return legacy
  } catch {
    return null
  }
}

export function saveConfig(config: VantageConfig): void {
  ensureDataDir()
  const envelope = encryptConfig(config, loadOrCreateKey())
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(envelope, null, 2), { encoding: 'utf8', mode: 0o600 })
}

export function applyConfig(config: VantageConfig): void {
  process.env.AZURE_TENANT_ID = config.AZURE_TENANT_ID
  process.env.AZURE_CLIENT_ID = config.AZURE_CLIENT_ID
  process.env.AZURE_CLIENT_SECRET = config.AZURE_CLIENT_SECRET
  if (config.API_KEY) process.env.API_KEY = config.API_KEY
  if (config.AZURE_DEVOPS_PAT) process.env.AZURE_DEVOPS_PAT = config.AZURE_DEVOPS_PAT
  if (config.GROQ_API_KEY && !process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = config.GROQ_API_KEY
  // Only override AI_DATA_CONSENT if the user explicitly saved a preference; leave .env value untouched otherwise
  if (typeof config.AI_DATA_CONSENT === 'boolean') process.env.AI_DATA_CONSENT = config.AI_DATA_CONSENT ? 'true' : 'false'
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.AZURE_TENANT_ID?.trim() &&
    process.env.AZURE_CLIENT_ID?.trim() &&
    process.env.AZURE_CLIENT_SECRET?.trim()
  )
}

export function resetSavedConfig(): void {
  for (const file of [CONFIG_PATH, LEGACY_CONFIG_PATH, KEY_PATH]) {
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  delete process.env.AZURE_TENANT_ID
  delete process.env.AZURE_CLIENT_ID
  delete process.env.AZURE_CLIENT_SECRET
  delete process.env.AZURE_DEVOPS_PAT
  delete process.env.API_KEY
  process.env.AI_DATA_CONSENT = 'false'
}
