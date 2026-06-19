import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '../../data')
const AUDIT_PATH = path.join(DATA_DIR, 'audit-log.json')
const MAX_EVENTS = 500

export type AuditAction =
  | 'option_set_restore'
  | 'connection_ref_auto_fix'
  | 'pipeline_cancel'
  | 'pipeline_retry'
  | 'optimizer_apply'
  | 'optimizer_apply_repo'

export type AuditTargetSystem = 'Dataverse' | 'Azure DevOps'
export type AuditStatus = 'success' | 'failure'

export interface AuditEvent {
  id: number
  timestamp: string
  action: AuditAction
  targetSystem: AuditTargetSystem
  target: string
  status: AuditStatus
  summary: string
  metadata?: Record<string, string | number | boolean | null | string[] | number[]>
}

export type NewAuditEvent = Omit<AuditEvent, 'id' | 'timestamp'>

function readAuditLog(): AuditEvent[] {
  if (!fs.existsSync(AUDIT_PATH)) return []
  return JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8'))
}

function writeAuditLog(events: AuditEvent[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(events.slice(-MAX_EVENTS), null, 2))
}

export function recordAuditEvent(event: NewAuditEvent): void {
  try {
    const events = readAuditLog()
    const id = events.length > 0 ? events[events.length - 1].id + 1 : 1
    events.push({
      id,
      timestamp: new Date().toISOString(),
      ...event,
    })
    writeAuditLog(events)
  } catch (err) {
    console.error('Failed to write audit event:', err instanceof Error ? err.message : err)
  }
}

export function getAuditEvents(limit = 100): AuditEvent[] {
  return readAuditLog()
    .reverse()
    .slice(0, Math.max(1, Math.min(limit, MAX_EVENTS)))
}
