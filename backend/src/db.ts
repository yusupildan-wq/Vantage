import fs from 'fs'
import path from 'path'
import { ScanResult } from './types'
import { getDataDir } from './config'

const DATA_DIR = getDataDir()
const DB_PATH = path.join(DATA_DIR, 'scans.json')

export interface ScanRecord {
  id: number
  environment_url: string
  scanned_at: string
  results: ScanResult[]
}

function read(): ScanRecord[] {
  if (!fs.existsSync(DB_PATH)) return []
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function write(records: ScanRecord[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2))
}

export function saveScan(environmentUrl: string, results: ScanResult[]): void {
  const records = read()
  const id = records.length > 0 ? records[records.length - 1].id + 1 : 1
  records.push({ id, environment_url: environmentUrl, scanned_at: new Date().toISOString(), results })
  write(records)
}

export function getScans(): Omit<ScanRecord, 'results'>[] {
  return read()
    .map(({ id, environment_url, scanned_at }) => ({ id, environment_url, scanned_at }))
    .reverse()
    .slice(0, 20)
}
