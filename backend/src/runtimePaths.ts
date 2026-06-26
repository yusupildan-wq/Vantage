import path from 'path'

export function getClientConfigDir(): string {
  if (process.env.VANTAGE_CONFIG_DIR?.trim()) return path.resolve(process.env.VANTAGE_CONFIG_DIR.trim())
  if ((process as any).pkg) return path.join(path.dirname(process.execPath), 'config', 'clients')
  return path.resolve(__dirname, '../../config/clients')
}
