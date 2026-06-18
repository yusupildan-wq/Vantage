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

export interface SuggestedFix {
  title: string
  fix: string
}

export interface FailedStep {
  stepName: string
  logLines: string[]
  suggestedFix: SuggestedFix | null
}

export interface RunErrorResponse {
  buildId: number
  failedSteps: FailedStep[]
}

const ERROR_PATTERNS: { pattern: RegExp; title: string; fix: string }[] = [
  { pattern: /npm ERR!.*peer dep|could not resolve dependency|peer dependency conflict/i,
    title: 'npm peer dependency conflict',
    fix: 'Run `npm install --legacy-peer-deps` or resolve the conflicting version in package.json.' },
  { pattern: /npm ERR!.*ENOENT|npm ERR!.*missing script/i,
    title: 'npm script or file not found',
    fix: 'Check that the script name in package.json is correct and all referenced files exist.' },
  { pattern: /npm ERR!.*network|npm ERR!.*ETIMEDOUT|npm ERR!.*ECONNREFUSED/i,
    title: 'npm network error',
    fix: 'The build agent cannot reach the npm registry. Check proxy/firewall settings on the agent.' },
  { pattern: /npm ERR!/i,
    title: 'npm error',
    fix: 'Check the npm error message in the logs and review your package.json.' },
  { pattern: /error TS\d+:/i,
    title: 'TypeScript compilation error',
    fix: 'Fix the TypeScript errors listed in the logs. Run `tsc --noEmit` locally to reproduce.' },
  { pattern: /error CS\d+:|msbuild.*failed|build failed/i,
    title: '.NET / MSBuild compilation error',
    fix: 'Fix the build errors listed in the logs. Run `dotnet build` locally to reproduce.' },
  { pattern: /the term 'dotnet' is not recognized|dotnet.*not found/i,
    title: '.NET SDK not installed on agent',
    fix: 'Add a "Use .NET Core" task before your build step to install the required SDK version.' },
  { pattern: /401.*unauthorized|403.*forbidden|authentication failed|could not authenticate/i,
    title: 'Authentication failed',
    fix: 'Service connection credentials have expired or lack permissions. Re-create the service connection in Azure DevOps → Project Settings → Service Connections.' },
  { pattern: /insufficient privileges|does not have.*permission|access denied/i,
    title: 'Insufficient permissions',
    fix: 'The service principal lacks required permissions. Check IAM/RBAC role assignments in the Azure portal.' },
  { pattern: /ECONNREFUSED/i,
    title: 'Connection refused',
    fix: 'The target service is not reachable. Check the service is running and accessible from the build agent.' },
  { pattern: /ETIMEDOUT|connection timed out|request timed out/i,
    title: 'Connection timed out',
    fix: 'Network timeout — check firewall rules or increase the timeout setting on the affected task.' },
  { pattern: /could not resolve host|name or service not known|dns.*failed/i,
    title: 'DNS resolution failed',
    fix: 'The build agent cannot resolve the hostname. Check DNS and network settings on the agent.' },
  { pattern: /no space left on device/i,
    title: 'Build agent disk full',
    fix: 'The agent has run out of disk space. Add a cleanup step at the start of the pipeline or switch to a larger agent.' },
  { pattern: /error response from daemon/i,
    title: 'Docker daemon error',
    fix: 'Docker failed on the agent. Verify the Docker service is running and the agent has Docker socket access.' },
  { pattern: /manifest.*not found|image.*not found/i,
    title: 'Docker image not found',
    fix: 'The Docker image does not exist in the registry. Check the image name, tag, and registry credentials.' },
  { pattern: /tests? failed|\.test\.[jt]s.*fail|assertionerror|expect.*received/i,
    title: 'Test suite failure',
    fix: 'One or more tests are failing. Run the test suite locally to reproduce and fix the failing assertions.' },
  { pattern: /the operation was canceled|job.*timed?\s*out|exceeded.*timeout/i,
    title: 'Pipeline job timed out',
    fix: 'The job exceeded its time limit. Increase `timeoutInMinutes` in your pipeline YAML or optimize slow steps.' },
  { pattern: /no such file or directory|enoent.*no such file/i,
    title: 'File or directory not found',
    fix: 'A referenced path does not exist on the agent. Check file paths in your pipeline YAML and ensure all files are committed.' },
  { pattern: /permission denied|eacces/i,
    title: 'Permission denied',
    fix: 'The agent lacks permission to access a file or resource. Check file permissions or use `chmod` in a prior step.' },
  { pattern: /the term .* is not recognized|command not found|not found in path/i,
    title: 'Command not found on agent',
    fix: 'A required tool is missing from the agent. Add an installation task before this step, or switch to an agent pool that has the tool.' },
  { pattern: /resourcenotfound|resource.*not found/i,
    title: 'Azure resource not found',
    fix: 'The referenced Azure resource does not exist. Check resource names, subscription ID, and region in your pipeline variables.' },
  { pattern: /process completed with exit code [^0]|exited with code [^0]|exit status [^0]/i,
    title: 'Script exited with an error',
    fix: 'A script returned a non-zero exit code. Scroll up in the logs to find the specific error message before this line.' },
]

function suggestFix(logLines: string[]): SuggestedFix | null {
  const combined = logLines.join('\n')
  for (const { pattern, title, fix } of ERROR_PATTERNS) {
    if (pattern.test(combined)) return { title, fix }
  }
  return null
}

function extractRelevantLines(raw: string, maxLines = 60): string[] {
  const lines = raw.split('\n')
    .map(l => l
      .replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
      .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z\s+/, '')
      .trimEnd()
    )
    .filter(l => l.trim())

  const errorIdx = lines.findIndex(l =>
    l.includes('##[error]') || /error:/i.test(l) || l.includes('FAILED') || l.includes('npm ERR!')
  )

  if (errorIdx !== -1) {
    const start = Math.max(0, errorIdx - 5)
    return lines.slice(start, errorIdx + 40)
  }
  return lines.slice(-maxLines)
}

export async function getRunError(
  projectUrl: string,
  pat: string,
  buildId: number
): Promise<RunErrorResponse> {
  const { org, project } = parseProjectUrl(projectUrl)
  const token = Buffer.from(`:${pat}`).toString('base64')

  const client = axios.create({
    baseURL: `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`,
    headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    timeout: 20000,
  })

  const timelineResp = await client.get(`/build/builds/${buildId}/timeline?api-version=7.1`)
  const records: any[] = timelineResp.data.records ?? []

  let failedRecords = records.filter(r => r.result === 'failed' && r.type === 'Task' && r.log?.id)
  if (failedRecords.length === 0) {
    failedRecords = records.filter(r => r.result === 'failed' && r.log?.id)
  }

  const failedSteps: FailedStep[] = []
  for (const record of failedRecords.slice(0, 3)) {
    try {
      const logResp = await client.get(
        `/build/builds/${buildId}/logs/${record.log.id}?api-version=7.1`,
        { headers: { Authorization: `Basic ${token}`, Accept: 'text/plain' }, responseType: 'text' }
      )
      const logLines = extractRelevantLines(String(logResp.data))
      const suggestedFix = suggestFix(logLines)
      failedSteps.push({ stepName: record.name as string, logLines, suggestedFix })
    } catch {
      // skip if log fetch fails for this step
    }
  }

  return { buildId, failedSteps }
}

export async function cancelPipelineRun(
  projectUrl: string,
  pat: string,
  buildId: number
): Promise<void> {
  const { org, project } = parseProjectUrl(projectUrl)
  const token = Buffer.from(`:${pat}`).toString('base64')
  await axios.patch(
    `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`,
    { status: 'cancelling' },
    { headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
  )
}

export interface RetryResult {
  retriedStages: string[]
  newBuildId?: number
}

export async function retryFailedJobs(
  projectUrl: string,
  pat: string,
  buildId: number
): Promise<RetryResult> {
  const { org, project } = parseProjectUrl(projectUrl)
  const token = Buffer.from(`:${pat}`).toString('base64')
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`
  const headers = { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }

  // Get timeline to find failed stages
  const timelineResp = await axios.get(`${base}/build/builds/${buildId}/timeline?api-version=7.1`, { headers, timeout: 15000 })
  const records: any[] = timelineResp.data.records ?? []
  const failedStages = records.filter(r => r.type === 'Stage' && r.result === 'failed' && r.identifier)

  if (failedStages.length > 0) {
    const retriedStages: string[] = []
    for (const stage of failedStages) {
      await axios.patch(
        `${base}/build/builds/${buildId}/stages/${encodeURIComponent(stage.identifier)}?api-version=7.1`,
        { state: 2, forceRetryAllJobs: false },
        { headers, timeout: 15000 }
      )
      retriedStages.push(stage.name as string)
    }
    return { retriedStages }
  }

  // No stages (flat pipeline) — queue a new run with the same definition + branch
  const buildResp = await axios.get(`${base}/build/builds/${buildId}?api-version=7.1`, { headers, timeout: 15000 })
  const build = buildResp.data
  const newResp = await axios.post(
    `${base}/build/builds?api-version=7.1`,
    {
      definition: { id: build.definition?.id },
      sourceBranch: build.sourceBranch,
      sourceVersion: build.sourceVersion,
      parameters: build.parameters ?? '{}',
    },
    { headers, timeout: 15000 }
  )
  return { retriedStages: [], newBuildId: newResp.data.id }
}

function normalizeDevOpsUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/ /g, '%20')
}

export function validateDevOpsUrl(rawUrl: string): void {
  let parsed: URL
  try { parsed = new URL(normalizeDevOpsUrl(rawUrl)) } catch {
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
  const parts = new URL(normalizeDevOpsUrl(rawUrl)).pathname.replace(/^\//, '').split('/').filter(Boolean)
  return { org: decodeURIComponent(parts[0]), project: decodeURIComponent(parts[1]) }
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
  if (!Array.isArray(buildsResp.data?.value)) {
    const contentType = String(buildsResp.headers?.['content-type'] ?? '')
    const authHint = buildsResp.status === 203 || !contentType.includes('application/json')
      ? ' Azure DevOps returned a sign-in/non-JSON response, which usually means the PAT is invalid, expired, or not authorized for this organization/project.'
      : ''
    throw new Error(`Azure DevOps did not return build run data.${authHint}`)
  }
  const buildValues = buildsResp.data.value

  const runs: PipelineRun[] = (buildValues as any[]).map(b => {
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
