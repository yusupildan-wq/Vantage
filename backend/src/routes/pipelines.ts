import { Router, Request, Response } from 'express'
import axios from 'axios'
import { getPipelineHealth, getRunError, cancelPipelineRun, retryFailedJobs, validateDevOpsUrl } from '../pipelines'
import { recordAuditEvent } from '../audit'

export const pipelinesRouter = Router()

pipelinesRouter.get('/health', async (req: Request, res: Response) => {
  const { projectUrl } = req.query
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl query param is required (e.g. https://dev.azure.com/org/project)' })
    return
  }
  try { validateDevOpsUrl(projectUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  const pat = process.env.AZURE_DEVOPS_PAT?.trim()
  if (!pat) {
    res.status(500).json({ error: 'AZURE_DEVOPS_PAT is not set. Add it to backend/.env.' })
    return
  }
  const daysRaw = req.query.days
  const days = daysRaw && typeof daysRaw === 'string' ? parseInt(daysRaw, 10) : undefined
  if (days !== undefined && (isNaN(days) || days < 0 || days > 365)) {
    res.status(400).json({ error: 'days must be a number between 0 and 365' }); return
  }
  try {
    const data = await getPipelineHealth(projectUrl, pat, days)
    res.json(data)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.response?.data?.error?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

pipelinesRouter.get('/run-error', async (req: Request, res: Response) => {
  const { projectUrl, buildId } = req.query
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl is required' }); return
  }
  if (!buildId || typeof buildId !== 'string' || isNaN(parseInt(buildId, 10))) {
    res.status(400).json({ error: 'buildId is required' }); return
  }
  try { validateDevOpsUrl(projectUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return
  }
  const pat = process.env.AZURE_DEVOPS_PAT?.trim()
  if (!pat) {
    res.status(500).json({ error: 'AZURE_DEVOPS_PAT is not set.' }); return
  }
  try {
    const data = await getRunError(projectUrl, pat, parseInt(buildId, 10))
    res.json(data)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    res.status(500).json({ error: detail })
  }
})

function requireProjectAndBuild(req: Request, res: Response): { projectUrl: string; buildId: number; pat: string } | null {
  const { projectUrl, buildId, safetyAcknowledged } = req.body
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl is required' }); return null
  }
  if (!buildId || isNaN(parseInt(buildId, 10))) {
    res.status(400).json({ error: 'buildId is required' }); return null
  }
  if (safetyAcknowledged !== true) {
    res.status(400).json({ error: 'Safety acknowledgement is required before changing pipeline runs.' }); return null
  }
  try { validateDevOpsUrl(projectUrl) } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return null
  }
  const pat = process.env.AZURE_DEVOPS_PAT?.trim()
  if (!pat) {
    res.status(500).json({ error: 'AZURE_DEVOPS_PAT is not set.' }); return null
  }
  return { projectUrl, buildId: parseInt(buildId, 10), pat }
}

pipelinesRouter.post('/cancel', async (req: Request, res: Response) => {
  const args = requireProjectAndBuild(req, res)
  if (!args) return
  try {
    await cancelPipelineRun(args.projectUrl, args.pat, args.buildId)
    recordAuditEvent({
      action: 'pipeline_cancel',
      targetSystem: 'Azure DevOps',
      target: args.projectUrl,
      status: 'success',
      summary: `Cancellation requested for build ${args.buildId}.`,
      metadata: { buildId: args.buildId },
    })
    res.json({ success: true })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.response?.data?.typeKey ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    recordAuditEvent({
      action: 'pipeline_cancel',
      targetSystem: 'Azure DevOps',
      target: args.projectUrl,
      status: 'failure',
      summary: detail,
      metadata: { buildId: args.buildId },
    })
    res.status(500).json({ error: detail })
  }
})

pipelinesRouter.post('/retry', async (req: Request, res: Response) => {
  const args = requireProjectAndBuild(req, res)
  if (!args) return
  try {
    const result = await retryFailedJobs(args.projectUrl, args.pat, args.buildId)
    recordAuditEvent({
      action: 'pipeline_retry',
      targetSystem: 'Azure DevOps',
      target: args.projectUrl,
      status: 'success',
      summary: result.retriedStages?.length
        ? `Retry requested for ${result.retriedStages.length} failed stage(s) in build ${args.buildId}.`
        : result.newBuildId
          ? `Queued replacement build ${result.newBuildId} for build ${args.buildId}.`
          : `Retry requested for build ${args.buildId}.`,
      metadata: {
        buildId: args.buildId,
        newBuildId: result.newBuildId ?? null,
        retriedStages: result.retriedStages ?? [],
      },
    })
    res.json(result)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.response?.data?.typeKey ?? err.message)
      : (err instanceof Error ? err.message : 'Failed')
    recordAuditEvent({
      action: 'pipeline_retry',
      targetSystem: 'Azure DevOps',
      target: args.projectUrl,
      status: 'failure',
      summary: detail,
      metadata: { buildId: args.buildId },
    })
    res.status(500).json({ error: detail })
  }
})
