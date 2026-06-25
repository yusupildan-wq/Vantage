import path from 'path'

export function getClientConfigDir(): string {
  if ((process as any).pkg) {
    return path.join(path.dirname(process.execPath), 'config', 'clients')
  }
  return path.resolve(__dirname, '../../config/clients')
}
