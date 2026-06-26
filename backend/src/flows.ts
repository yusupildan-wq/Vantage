import { AxiosInstance, AxiosResponse } from 'axios'

export async function fetchAllPages(client: AxiosInstance, url: string): Promise<any[]> {
  const results: any[] = []
  let next: string | null = url
  while (next) {
    const resp: AxiosResponse = await client.get(next)
    results.push(...(resp.data.value ?? []))
    next = (resp.data['@odata.nextLink'] as string | undefined) ?? null
  }
  return results
}

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
  triggerHealth: 'ok' | 'stale' | 'never_run'
  daysSinceLastRun: number | null
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

export type FlowCompareStatus = 'match' | 'drift' | 'source_only' | 'target_only'

export interface FlowCompareEntry {
  name: string
  status: FlowCompareStatus
  source: { enabled: boolean; modifiedOn: string } | null
  target: { enabled: boolean; modifiedOn: string } | null
  driftReasons: string[]
}

async function getFlowIdsForSolution(client: AxiosInstance, solutionUniqueName: string): Promise<Set<string>> {
  const solResp = await client.get(
    `/solutions?$filter=uniquename eq '${solutionUniqueName}'&$select=solutionid`
  )
  const solution = solResp.data.value?.[0]
  if (!solution) throw new Error(`Solution '${solutionUniqueName}' not found in this environment`)
  const solutionId = (solution.solutionid as string).toLowerCase()
  // Fetch all pages of workflow-type components and filter in JS — OData filter on
  // _solutionid_value is unreliable across Dataverse environments.
  const components = await fetchAllPages(
    client,
    `/solutioncomponents?$filter=componenttype eq 29&$select=objectid,_solutionid_value`
  )
  return new Set(
    components
      .filter((c: any) => ((c['_solutionid_value'] as string) ?? '').toLowerCase() === solutionId)
      .map((c: any) => (c.objectid as string).toLowerCase())
  )
}

async function getFlowList(
  client: AxiosInstance,
  solutionFlowIds?: Set<string>
): Promise<{ name: string; enabled: boolean; modifiedOn: string }[]> {
  const flows = await fetchAllPages(
    client,
    `/workflows?$filter=category eq 5&$select=workflowid,name,statecode,modifiedon&$orderby=name asc`
  )
  const filtered = solutionFlowIds
    ? flows.filter((f: any) => solutionFlowIds.has(f.workflowid.toLowerCase()))
    : flows
  return filtered.map((f: any) => ({
    name: f.name,
    enabled: f.statecode === 1,
    modifiedOn: f.modifiedon,
  }))
}

export async function compareFlows(
  sourceClient: AxiosInstance,
  targetClient: AxiosInstance,
  solutionUniqueName?: string
): Promise<FlowCompareEntry[]> {
  let sourceFlowIds: Set<string> | undefined
  let targetFlowIds: Set<string> | undefined
  if (solutionUniqueName) {
    ;[sourceFlowIds, targetFlowIds] = await Promise.all([
      getFlowIdsForSolution(sourceClient, solutionUniqueName),
      getFlowIdsForSolution(targetClient, solutionUniqueName),
    ])
  }
  const [sourceFlows, targetFlows] = await Promise.all([
    getFlowList(sourceClient, sourceFlowIds),
    getFlowList(targetClient, targetFlowIds),
  ])

  const sourceMap = new Map(sourceFlows.map(f => [f.name.trim().toLowerCase(), f]))
  const targetMap = new Map(targetFlows.map(f => [f.name.trim().toLowerCase(), f]))
  const allNames = new Set([...sourceMap.keys(), ...targetMap.keys()])

  const results: FlowCompareEntry[] = []

  for (const key of allNames) {
    const s = sourceMap.get(key) ?? null
    const t = targetMap.get(key) ?? null

    if (s && !t) {
      results.push({ name: s.name, status: 'source_only', source: s, target: null, driftReasons: ['Not deployed to target'] })
    } else if (!s && t) {
      results.push({ name: t.name, status: 'target_only', source: null, target: t, driftReasons: ['Not present in source'] })
    } else if (s && t) {
      const driftReasons: string[] = []
      if (s.enabled !== t.enabled) {
        driftReasons.push(`${s.enabled ? 'Enabled' : 'Disabled'} in source, ${t.enabled ? 'enabled' : 'disabled'} in target`)
      }
      const srcDate = new Date(s.modifiedOn).getTime()
      const tgtDate = new Date(t.modifiedOn).getTime()
      const diffDays = Math.round(Math.abs(srcDate - tgtDate) / 86400000)
      if (diffDays >= 1) {
        const newer = srcDate > tgtDate ? 'source' : 'target'
        driftReasons.push(`${newer === 'source' ? 'Source' : 'Target'} modified ${diffDays}d more recently — may have undeployed changes`)
      }
      results.push({
        name: s.name,
        status: driftReasons.length > 0 ? 'drift' : 'match',
        source: s,
        target: t,
        driftReasons,
      })
    }
  }

  return results.sort((a, b) => {
    const order: Record<FlowCompareStatus, number> = { drift: 0, source_only: 1, target_only: 2, match: 3 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })
}

export async function getFlowHealth(client: AxiosInstance, solutionUniqueName?: string): Promise<FlowHealth[]> {
  let flows = await fetchAllPages(
    client,
    `/workflows?$filter=category eq 5&$select=workflowid,name,statecode,modifiedon,_ownerid_value&$orderby=name asc`
  )
  if (solutionUniqueName) {
    const ids = await getFlowIdsForSolution(client, solutionUniqueName)
    flows = flows.filter((f: any) => ids.has(f.workflowid.toLowerCase()))
  }
  if (flows.length === 0) return []

  // Fetch recent run sessions across all flows in one call
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [recentResp, failureResp] = await Promise.all([
    client.get(
      `/flowsessions?$orderby=completedon desc&$top=500&$select=statecode,completedon,startedon,_regardingobjectid_value,context&$filter=completedon ge ${sevenDaysAgo}`
    ),
    client.get(
      `/flowsessions?$filter=statecode eq 2 and completedon ge ${sevenDaysAgo}&$select=_regardingobjectid_value,statecode,completedon`
    ),
  ])

  const recentSessions: any[] = recentResp.data.value ?? []
  const failedSessions: any[] = failureResp.data.value ?? []

  // Group recent sessions by flow id
  const sessionsByFlow = new Map<string, any[]>()
  for (const s of recentSessions) {
    const fid = s['_regardingobjectid_value']
    if (!fid) continue
    if (!sessionsByFlow.has(fid)) sessionsByFlow.set(fid, [])
    sessionsByFlow.get(fid)!.push(s)
  }

  // Count failures per flow
  const failuresByFlow = new Map<string, number>()
  for (const s of failedSessions) {
    const fid = s['_regardingobjectid_value']
    if (!fid) continue
    failuresByFlow.set(fid, (failuresByFlow.get(fid) ?? 0) + 1)
  }

  // Enabled flows with no sessions in 7d — check when they last ran (ever)
  const staleFlowIds = flows
    .filter(f => f.statecode === 1 && !sessionsByFlow.has(f.workflowid))
    .map(f => f.workflowid)

  const lastRunEverMap = new Map<string, string | null>()
  if (staleFlowIds.length > 0) {
    await Promise.all(
      staleFlowIds.map(async (flowId) => {
        try {
          const r = await client.get(
            `/flowsessions?$filter=_regardingobjectid_value eq ${flowId}&$orderby=completedon desc&$top=1&$select=completedon,startedon`
          )
          const s = r.data.value[0] ?? null
          lastRunEverMap.set(flowId, s?.completedon ?? s?.startedon ?? null)
        } catch {
          lastRunEverMap.set(flowId, null)
        }
      })
    )
  }

  return flows.map(f => {
    const sessions = (sessionsByFlow.get(f.workflowid) ?? []).slice(0, 10)
    const runs = sessions.map(sessionToRun)

    let triggerHealth: 'ok' | 'stale' | 'never_run' = 'ok'
    let daysSinceLastRun: number | null = null

    if (f.statecode === 1) {
      if (runs.length > 0) {
        // Ran in last 7 days — healthy
        if (runs[0].timestamp) {
          daysSinceLastRun = Math.round((Date.now() - new Date(runs[0].timestamp).getTime()) / 86400000)
        }
        triggerHealth = 'ok'
      } else {
        // No runs in last 7 days — check history
        const lastEver = lastRunEverMap.get(f.workflowid) ?? null
        if (lastEver) {
          daysSinceLastRun = Math.round((Date.now() - new Date(lastEver).getTime()) / 86400000)
          triggerHealth = 'stale'
        } else {
          triggerHealth = 'never_run'
        }
      }
    }

    return {
      flowId: f.workflowid,
      name: f.name,
      enabled: f.statecode === 1,
      lastRun: runs[0] ?? null,
      failureCount7d: failuresByFlow.get(f.workflowid) ?? 0,
      recentRuns: runs,
      owner: f['_ownerid_value'] ?? '',
      modifiedOn: f.modifiedon,
      triggerHealth,
      daysSinceLastRun,
    }
  })
}
