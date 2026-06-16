import { AxiosInstance } from 'axios'

export type FlowRunStatus = 'succeeded' | 'failed' | 'running' | 'cancelled' | 'waiting'

export interface FlowLastRun {
  status: FlowRunStatus
  timestamp: string | null
  errorMessage: string | null
  durationSeconds: number | null
}

export interface FlowHealth {
  flowId: string
  name: string
  enabled: boolean
  lastRun: FlowLastRun | null
  failureCount7d: number
  recentRuns: FlowLastRun[]
  owner: string
  modifiedOn: string
}

const RUN_STATUS_MAP: Record<number, FlowRunStatus> = {
  0: 'running',
  1: 'succeeded',
  2: 'failed',
  3: 'cancelled',
  4: 'waiting',
}

function extractError(context: string | null): string | null {
  if (!context) return null
  try {
    const parsed = JSON.parse(context)
    return (
      parsed?.error?.message ??
      parsed?.message ??
      parsed?.body?.message ??
      parsed?.body?.error?.message ??
      null
    )
  } catch {
    return null
  }
}

function sessionToRun(s: any): FlowLastRun {
  const start = s.startedon ? new Date(s.startedon).getTime() : null
  const end = s.completedon ? new Date(s.completedon).getTime() : null
  return {
    status: RUN_STATUS_MAP[s.statecode] ?? 'running',
    timestamp: s.completedon ?? s.startedon ?? null,
    errorMessage: s.statecode === 2 ? extractError(s.context ?? null) : null,
    durationSeconds: start && end ? Math.round((end - start) / 1000) : null,
  }
}

export async function getFlowHealth(client: AxiosInstance): Promise<FlowHealth[]> {
  // Fetch all modern cloud flows (category 5)
  const flowsResp = await client.get(
    `/workflows?$filter=category eq 5&$select=workflowid,name,statecode,modifiedon,_ownerid_value&$orderby=name asc`
  )
  const flows: any[] = flowsResp.data.value ?? []
  if (flows.length === 0) return []

  // Fetch recent run sessions across all flows in one call
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [recentResp, failureResp] = await Promise.all([
    client.get(
      `/flowsessions?$orderby=completedon desc&$top=500&$select=statecode,completedon,startedon,_workflow_value,context&$filter=completedon ge ${sevenDaysAgo}`
    ),
    client.get(
      `/flowsessions?$filter=statecode eq 2 and completedon ge ${sevenDaysAgo}&$select=_workflow_value,statecode,completedon`
    ),
  ])

  const recentSessions: any[] = recentResp.data.value ?? []
  const failedSessions: any[] = failureResp.data.value ?? []

  // Group recent sessions by flow id
  const sessionsByFlow = new Map<string, any[]>()
  for (const s of recentSessions) {
    const fid = s['_workflow_value']
    if (!fid) continue
    if (!sessionsByFlow.has(fid)) sessionsByFlow.set(fid, [])
    sessionsByFlow.get(fid)!.push(s)
  }

  // Count failures per flow
  const failuresByFlow = new Map<string, number>()
  for (const s of failedSessions) {
    const fid = s['_workflow_value']
    if (!fid) continue
    failuresByFlow.set(fid, (failuresByFlow.get(fid) ?? 0) + 1)
  }

  return flows.map(f => {
    const sessions = (sessionsByFlow.get(f.workflowid) ?? []).slice(0, 10)
    const runs = sessions.map(sessionToRun)
    return {
      flowId: f.workflowid,
      name: f.name,
      enabled: f.statecode === 1,
      lastRun: runs[0] ?? null,
      failureCount7d: failuresByFlow.get(f.workflowid) ?? 0,
      recentRuns: runs,
      owner: f['_ownerid_value'] ?? '',
      modifiedOn: f.modifiedon,
    }
  })
}
