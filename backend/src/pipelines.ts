import axios from 'axios'

export interface PipelineRun {
  id: number
  buildNumber: string
  pipelineId: number
  pipelineName: string
  pipelineFolder: string
  status: 'succeeded' | 'partiallySucceeded' | 'failed' | 'running' | 'pending' | 'cancelled' | 'unknown'
  branch: string
  reason: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  triggeredBy: string
}

export interface PipelineSummary {
  pipelineId: number
  pipelineName: string
  pipelineFolder: string
  totalRuns: number
  successCount: number
  failureCount: number
  successRate: number
  avgDurationMs: number | null
  lastRunAt: string | null
  lastRunStatus: string | null
}

export interface PipelineHealthResponse {
  organization: string
  project: string
  totalRuns: number
  successCount: number
  failureCount: number
  avgDurationMs: number | null
  pipelines: PipelineSummary[]
  runs: PipelineRun[]
}

export function validateDevOpsUrl(rawUrl: string): void {
  let parsed: URL
  try { parsed = new URL(rawUrl) } catch {
    throw new Error('Invalid URL format')
  }
  if (parsed.protocol !== 'https:') throw new Error('URL must use HTTPS')
  if (!parsed.hostname.endsWith('dev.azure.com') && !parsed.hostname.endsWith('visualstudio.com')) {
    throw new Error('URL must be a valid Azure DevOps URL (e.g. https://dev.azure.com/org/project)')
  }
  const parts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean)
  if (parts.length < 2) {
    throw new Error('URL must include both organization and project: https://dev.azure.com/org/project')
  }
}

function parseProjectUrl(rawUrl: string): { org: string; project: string } {
  const parts = new URL(rawUrl).pathname.replace(/^\//, '').split('/').filter(Boolean)
  return { org: parts[0], project: parts[1] }
}

function mapStatus(status: string, result?: string): PipelineRun['status'] {
  if (status === 'inProgress' || status === 'cancelling') return 'running'
  if (status === 'notStarted' || status === 'postponed') return 'pending'
  if (status === 'completed') {
    if (result === 'succeeded') return 'succeeded'
    if (result === 'partiallySucceeded') return 'partiallySucceeded'
    if (result === 'failed') return 'failed'
    if (result === 'canceled') return 'cancelled'
  }
  return 'unknown'
}

const REASON_LABELS: Record<string, string> = {
  individualCI: 'CI',
  batchedCI:    'Batched CI',
  pullRequest:  'PR',
  manual:       'Manual',
  schedule:     'Scheduled',
  triggered:    'Triggered',
}

export async function getPipelineHealth(
  projectUrl: string,
  pat: string,
  days?: number
): Promise<PipelineHealthResponse> {
  const { org, project } = parseProjectUrl(projectUrl)
  const token = Buffer.from(`:${pat}`).toString('base64')

  const client = axios.create({
    baseURL: `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`,
    headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    timeout: 30000,
  })

  const top = !days ? 200 : days <= 7 ? 200 : days <= 30 ? 500 : 1000
  const params: Record<string, string> = {
    'api-version': '7.1',
    '$top': String(top),
    'queryOrder': 'queueTimeDescending',
  }
  if (days && days > 0) {
    params['minTime'] = new Date(Date.now() - days * 86400000).toISOString()
  }
  const buildsResp = await client.get(`/build/builds?${new URLSearchParams(params)}`)

  const runs: PipelineRun[] = (buildsResp.data.value as any[]).map(b => {
    const status = mapStatus(b.status, b.result)
    const startedAt: string | null = b.startTime ?? b.queueTime ?? null
    const completedAt: string | null = b.finishTime ?? null
    const durationMs =
      startedAt && completedAt
        ? Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime())
        : null
    const rawFolder: string = b.definition?.path ?? '\\'
    const folder = rawFolder.replace(/^\\/, '').replace(/\\/g, ' / ') || 'Root'

    return {
      id: b.id as number,
      buildNumber: String(b.buildNumber ?? b.id),
      pipelineId: b.definition?.id ?? 0,
      pipelineName: b.definition?.name ?? 'Unknown',
      pipelineFolder: folder,
      status,
      branch: (b.sourceBranch ?? '').replace('refs/heads/', ''),
      reason: REASON_LABELS[b.reason] ?? (b.reason ?? 'Unknown'),
      startedAt,
      completedAt,
      durationMs,
      triggeredBy: b.requestedFor?.displayName ?? b.requestedBy?.displayName ?? 'System',
    }
  })

  const pipelineMap = new Map<number, { id: number; name: string; folder: string; runs: PipelineRun[] }>()
  for (const run of runs) {
    if (!pipelineMap.has(run.pipelineId)) {
      pipelineMap.set(run.pipelineId, {
        id: run.pipelineId, name: run.pipelineName, folder: run.pipelineFolder, runs: [],
      })
    }
    pipelineMap.get(run.pipelineId)!.runs.push(run)
  }

  const pipelines: PipelineSummary[] = Array.from(pipelineMap.values()).map(({ id, name, folder, runs: pr }) => {
    const successCount = pr.filter(r => r.status === 'succeeded').length
    const failureCount = pr.filter(r => r.status === 'failed' || r.status === 'partiallySucceeded').length
    const completedRuns = pr.filter(r => r.durationMs !== null && r.durationMs > 0)
    const avgDurationMs = completedRuns.length > 0
      ? Math.round(completedRuns.reduce((s, r) => s + r.durationMs!, 0) / completedRuns.length)
      : null
    return {
      pipelineId: id,
      pipelineName: name,
      pipelineFolder: folder,
      totalRuns: pr.length,
      successCount,
      failureCount,
      successRate: pr.length > 0 ? Math.round((successCount / pr.length) * 100) : 0,
      avgDurationMs,
      lastRunAt: pr[0]?.startedAt ?? null,
      lastRunStatus: pr[0]?.status ?? null,
    }
  })

  const successCount = runs.filter(r => r.status === 'succeeded').length
  const failureCount = runs.filter(r => r.status === 'failed' || r.status === 'partiallySucceeded').length
  const completedRuns = runs.filter(r => r.durationMs !== null && r.durationMs > 0)
  const avgDurationMs = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((s, r) => s + r.durationMs!, 0) / completedRuns.length)
    : null

  return { organization: org, project, totalRuns: runs.length, successCount, failureCount, avgDurationMs, pipelines, runs }
}
