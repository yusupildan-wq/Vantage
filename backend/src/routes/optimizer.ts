import { Router, Request, Response } from 'express'
import axios from 'axios'
import { listDefinitions, fetchAndAnalyze, createOptimizationPRSafely, analyzeRepository, createRepoOptimizationPRs } from '../optimizer'
import { recordAuditEvent } from '../audit'

export const optimizerRouter = Router()

function getPat(res: Response): string | null {
  const pat = process.env.AZURE_DEVOPS_PAT?.trim()
  if (!pat) {
    res.status(500).json({ error: 'AZURE_DEVOPS_PAT is not set.' })
    return null
  }
  return pat
}

function handleError(res: Response, err: unknown) {
  const detail = axios.isAxiosError(err)
    ? (err.response?.data?.message ?? err.response?.data?.typeKey ?? err.message)
    : (err instanceof Error ? err.message : 'Unknown error')
  res.status(500).json({ error: detail })
}

// GET /api/optimizer/definitions?projectUrl=...
optimizerRouter.get('/definitions', async (req: Request, res: Response) => {
  const { projectUrl } = req.query
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl is required' }); return
  }
  const pat = getPat(res)
  if (!pat) return
  try {
    const definitions = await listDefinitions(projectUrl, pat)
    res.json({ definitions })
  } catch (err) { handleError(res, err) }
})

// GET /api/optimizer/analyze?projectUrl=...&definitionId=...
optimizerRouter.get('/analyze', async (req: Request, res: Response) => {
  const { projectUrl, definitionId } = req.query
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl is required' }); return
  }
  if (!definitionId || typeof definitionId !== 'string' || isNaN(parseInt(definitionId, 10))) {
    res.status(400).json({ error: 'definitionId is required' }); return
  }
  const pat = getPat(res)
  if (!pat) return
  try {
    const result = await fetchAndAnalyze(projectUrl, pat, parseInt(definitionId, 10))
    res.json(result)
  } catch (err) { handleError(res, err) }
})

// POST /api/optimizer/apply
// body: { projectUrl, repositoryId, yamlPath, optimizedYaml, pipelineName, defaultBranch, dryRun?, fileChanges? }
optimizerRouter.post('/apply', async (req: Request, res: Response) => {
  const { projectUrl, repositoryId, yamlPath, optimizedYaml, pipelineName, defaultBranch, dryRun, fileChanges, safetyAcknowledged, createDraftOnly } = req.body
  if (!projectUrl || !repositoryId || !yamlPath || !optimizedYaml || !pipelineName || !defaultBranch) {
    res.status(400).json({ error: 'Missing required fields: projectUrl, repositoryId, yamlPath, optimizedYaml, pipelineName, defaultBranch' })
    return
  }
  if (safetyAcknowledged !== true || createDraftOnly !== true) {
    res.status(400).json({ error: 'Safety acknowledgement is required before creating optimizer PRs.' })
    return
  }
  const pat = getPat(res)
  if (!pat) return
  try {
    const result = await createOptimizationPRSafely(projectUrl, pat, repositoryId, yamlPath, optimizedYaml, pipelineName, defaultBranch, Boolean(dryRun), fileChanges)
    recordAuditEvent({
      action: 'optimizer_apply',
      targetSystem: 'Azure DevOps',
      target: projectUrl,
      status: 'success',
      summary: `Created draft optimizer PR ${result.prId} for ${pipelineName}.`,
      metadata: {
        pipelineName,
        repositoryId,
        yamlPath,
        targetBranch: defaultBranch,
        branchName: result.branchName,
        prId: result.prId,
        draft: result.draft ?? true,
        fileCount: Array.isArray(fileChanges) ? fileChanges.length : 1,
      },
    })
    res.json(result)
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.response?.data?.typeKey ?? err.message)
      : (err instanceof Error ? err.message : 'Unknown error')
    recordAuditEvent({
      action: 'optimizer_apply',
      targetSystem: 'Azure DevOps',
      target: projectUrl,
      status: 'failure',
      summary: detail,
      metadata: { pipelineName, repositoryId, yamlPath, targetBranch: defaultBranch },
    })
    res.status(500).json({ error: detail })
  }
})

// GET /api/optimizer/analyze-repo?projectUrl=...
// Scans ALL YAML pipelines in the project, crawls their templates, deduplicates files per repo
optimizerRouter.get('/analyze-repo', async (req: Request, res: Response) => {
  const { projectUrl } = req.query
  if (!projectUrl || typeof projectUrl !== 'string') {
    res.status(400).json({ error: 'projectUrl is required' }); return
  }
  const pat = getPat(res)
  if (!pat) return
  try {
    const result = await analyzeRepository(projectUrl, pat)
    res.json(result)
  } catch (err) { handleError(res, err) }
})

// POST /api/optimizer/apply-repo
// body: { projectUrl, groups: RepoOptimizationGroup[] }
// Creates one draft PR per repository group with all file changes in a single commit
optimizerRouter.post('/apply-repo', async (req: Request, res: Response) => {
  const { projectUrl, groups, safetyAcknowledged, createDraftOnly } = req.body
  if (!projectUrl || !Array.isArray(groups) || groups.length === 0) {
    res.status(400).json({ error: 'projectUrl and groups[] are required' }); return
  }
  if (safetyAcknowledged !== true || createDraftOnly !== true) {
    res.status(400).json({ error: 'Safety acknowledgement is required before creating optimizer PRs.' })
    return
  }
  const pat = getPat(res)
  if (!pat) return
  try {
    const results = await createRepoOptimizationPRs(projectUrl, pat, groups)
    recordAuditEvent({
      action: 'optimizer_apply_repo',
      targetSystem: 'Azure DevOps',
      target: projectUrl,
      status: 'success',
      summary: `Created ${results.length} repository optimizer draft PR(s).`,
      metadata: {
        repositories: groups.map((group: any) => group.repositoryName),
        pullRequestIds: results.map(result => result.prId),
        branches: results.map(result => result.branchName),
        draftOnly: true,
        fileCount: groups.reduce((sum: number, group: any) => sum + group.fileChanges.filter((file: any) => file.changed).length, 0),
      },
    })
    res.json({ pullRequests: results })
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.response?.data?.typeKey ?? err.message)
      : (err instanceof Error ? err.message : 'Unknown error')
    recordAuditEvent({
      action: 'optimizer_apply_repo',
      targetSystem: 'Azure DevOps',
      target: projectUrl,
      status: 'failure',
      summary: detail,
      metadata: {
        repositories: groups.map((group: any) => group.repositoryName),
        draftOnly: true,
      },
    })
    res.status(500).json({ error: detail })
  }
})
