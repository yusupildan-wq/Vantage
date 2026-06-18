import axios from 'axios'

export interface PipelineDefinition {
  id: number
  name: string
  yamlFilename: string | null
  repositoryId: string
  repositoryName: string
  optimizable: boolean
  reason?: string
}

export interface Optimization {
  id: string
  title: string
  description: string
  estimatedSavingMinutes: number
  confidence: 'high' | 'medium' | 'low'
  category: 'speed' | 'cache' | 'parallelism' | 'cleanup'
}

export interface AnalysisResult {
  pipelineName: string
  yamlPath: string
  repositoryId: string
  repositoryName: string
  defaultBranch: string
  originalYaml: string
  optimizedYaml: string
  fileChanges: OptimizedFile[]
  optimizations: Optimization[]
  estimatedSavingMinutes: number
}

export interface OptimizedFile {
  path: string
  project: string
  repositoryId: string
  repositoryName: string
  defaultBranch: string
  originalContent: string
  optimizedContent: string
  optimizations: Optimization[]
  changed: boolean
}

export interface PullRequestResult {
  prId: number
  prUrl: string
  branchName: string
  repositoryName: string
  targetBranch: string
  draft: boolean
}

export interface PRResult {
  prId: number
  prUrl: string
  branchName: string
  pipelineName: string
  targetBranch?: string
  draft?: boolean
  pullRequests?: PullRequestResult[]
}

export interface RepoOptimizationGroup {
  repositoryId: string
  repositoryName: string
  defaultBranch: string
  pipelineNames: string[]
  fileChanges: OptimizedFile[]
  optimizations: Optimization[]
  estimatedSavingMinutes: number
}

export interface RepoAnalysisResult {
  groups: RepoOptimizationGroup[]
  totalPipelines: number
  totalFilesScanned: number
  totalFilesChanged: number
  totalEstimatedSavingMinutes: number
}

function makeHeaders(pat: string) {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function parseUrl(rawUrl: string): { org: string; project: string } {
  const url = new URL(rawUrl.trim().replace(/ /g, '%20'))
  const parts = url.pathname.replace(/^\//, '').split('/').filter(Boolean)
  return { org: decodeURIComponent(parts[0]), project: decodeURIComponent(parts[1]) }
}

function normalizeRepoPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function assertSafeOptimizerPath(path: string): string {
  const normalised = normalizeRepoPath(path).replace(/\\/g, '/')
  if (normalised === '/' || normalised.includes('..') || /[\r\n]/.test(normalised)) {
    throw new Error(`Safety stop: invalid repository path ${path}.`)
  }
  return normalised
}

function dirname(path: string): string {
  const normalised = normalizeRepoPath(path)
  const idx = normalised.lastIndexOf('/')
  return idx <= 0 ? '/' : normalised.slice(0, idx)
}

async function pConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<({ ok: true; value: T } | { ok: false })[]> {
  const results: ({ ok: true; value: T } | { ok: false })[] = new Array(tasks.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++
      try { results[i] = { ok: true, value: await tasks[i]() } }
      catch { results[i] = { ok: false } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

function injectCheckoutProp(yaml: string, propName: string, propValue: string): string {
  if (new RegExp(`^[ \\t]*${propName}:`, 'm').test(yaml)) return yaml
  // Multi-line checkout block (already has other properties)
  let result = yaml.replace(
    /^([ \t]*-\s*checkout:\s*self\n)((?:[ \t]+[^\n]+\n)+)/gm,
    (match, header, block) => {
      if (new RegExp(`\\b${propName}:`).test(block)) return match
      const indent = header.match(/^([ \t]*)/)?.[1] ?? ''
      return `${header}${block}${indent}  ${propName}: ${propValue}\n`
    }
  )
  // Standalone - checkout: self
  result = result.replace(
    /^([ \t]*)-\s*checkout:\s*self\s*$/gm,
    (_, indent) => `${indent}- checkout: self\n${indent}  ${propName}: ${propValue}`
  )
  return result
}

function injectTaskInputProp(yaml: string, taskRegex: RegExp, propName: string, propValue: string): string {
  if (new RegExp(`^[ \\t]*${propName}:`, 'm').test(yaml)) return yaml
  return yaml.replace(
    new RegExp(
      `^([ \\t]*-[ \\t]*task:[ \\t]*${taskRegex.source}[^\\n]*\\n(?:[ \\t]+(?!inputs:)[^\\n]*\\n)*[ \\t]+inputs:\\n)([ \\t]+\\w[^\\n]*\\n)`,
      'gm'
    ),
    (_: string, header: string, firstInput: string) => {
      const indent = firstInput.match(/^([ \t]+)/)?.[1] ?? '        '
      return `${header}${firstInput}${indent}${propName}: ${propValue}\n`
    }
  )
}

function injectTaskInputPropForEach(yaml: string, taskRegex: RegExp, propName: string, propValue: string): string {
  return yaml.replace(
    new RegExp(
      `^([ \\t]*-[ \\t]*task:[ \\t]*${taskRegex.source}[^\\n]*\\n(?:[ \\t]+(?!inputs:)[^\\n]*\\n)*[ \\t]+inputs:\\n)((?:[ \\t]+[^\\n]*\\n)+)`,
      'gm'
    ),
    (match: string, header: string, inputsBlock: string) => {
      if (new RegExp(`^[ \\t]*${propName}:`, 'mi').test(inputsBlock)) return match
      const indent = inputsBlock.match(/^([ \t]+)/)?.[1] ?? '        '
      return `${header}${inputsBlock}${indent}${propName}: ${propValue}\n`
    }
  )
}

function injectTaskTopLevelProp(yaml: string, taskRegex: RegExp, propName: string, propValue: string): string {
  return yaml.replace(
    new RegExp(`^([ \\t]*-[ \\t]*task:[ \\t]*${taskRegex.source}[^\\n]*\\n)((?:[ \\t]+[^\\n]*\\n)*)`, 'gm'),
    (match: string, taskLine: string, body: string) => {
      if (new RegExp(`^[ \\t]*${propName}:`, 'mi').test(body)) return match
      const indent = taskLine.match(/^([ \t]*)/)?.[1] ?? ''
      return `${taskLine}${indent}  ${propName}: ${propValue}\n${body}`
    }
  )
}

interface RepoResource {
  alias: string
  project?: string
  repositoryName: string
  ref?: string
}

interface TemplateRef {
  path: string
  alias?: string
}

interface FileToInspect {
  path: string
  project: string
  repositoryId: string
  repositoryName: string
  defaultBranch: string
}

function splitTemplateRef(templatePath: string): { path: string; alias?: string } {
  const clean = templatePath.replace(/^['"]|['"]$/g, '').trim()
  const [path, alias] = clean.split('@')
  return { path, alias }
}

function resolveTemplatePath(fromPath: string, templatePath: string): string {
  const clean = splitTemplateRef(templatePath).path
  if (!clean || clean.startsWith('http')) return ''
  const base = clean.startsWith('/') ? clean : `${dirname(fromPath)}/${clean}`
  const parts: string[] = []
  for (const part of base.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

function parseRepositoryResources(yaml: string): Map<string, RepoResource> {
  const resources = new Map<string, RepoResource>()
  const repoBlock = /^\s*-\s*repository:\s*['"]?([^'"\s#]+)['"]?([\s\S]*?)(?=^\s*-\s*repository:|^\S|$)/gm
  let match: RegExpExecArray | null
  while ((match = repoBlock.exec(yaml)) !== null) {
    const alias = match[1]
    const block = match[2] ?? ''
    const type = block.match(/^\s*type:\s*['"]?([^'"\s#]+)['"]?/m)?.[1]
    const name = block.match(/^\s*name:\s*['"]?([^'"\r\n#]+)['"]?/m)?.[1]?.trim()
    const ref = block.match(/^\s*ref:\s*['"]?([^'"\s#]+)['"]?/m)?.[1]
    if (type && type !== 'git') continue
    if (!name) continue
    const [projectOrRepo, repoMaybe] = name.split('/')
    resources.set(alias, {
      alias,
      project: repoMaybe ? projectOrRepo : undefined,
      repositoryName: repoMaybe ?? projectOrRepo,
      ref,
    })
  }
  return resources
}

function findTemplateRefs(yaml: string, fromPath: string): TemplateRef[] {
  const refs = new Map<string, TemplateRef>()
  const patterns = [
    /^\s*-\s*template:\s*['"]?([^'"\s#]+)['"]?/gm,
    /^\s*template:\s*['"]?([^'"\s#]+)['"]?/gm,
  ]
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(yaml)) !== null) {
      const { alias } = splitTemplateRef(match[1])
      const resolved = resolveTemplatePath(fromPath, match[1])
      if (resolved && /\.(ya?ml)$/i.test(resolved)) refs.set(`${alias ?? ''}:${resolved}`, { path: resolved, alias })
    }
  }
  return Array.from(refs.values())
}

async function fetchRepoText(base: string, headers: ReturnType<typeof makeHeaders>, repositoryId: string, path: string): Promise<string> {
  const resp = await axios.get(
    `${base}/git/repositories/${repositoryId}/items?path=${encodeURIComponent(normalizeRepoPath(path))}&api-version=7.1`,
    { headers: { Authorization: headers.Authorization, Accept: 'text/plain' }, responseType: 'text', timeout: 15000 }
  )
  return String(resp.data)
}

async function getRepositoryContext(
  org: string,
  project: string,
  headers: ReturnType<typeof makeHeaders>,
  repositoryName: string,
  ref?: string
): Promise<FileToInspect> {
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`
  const resp = await axios.get(
    `${base}/git/repositories/${encodeURIComponent(repositoryName)}?api-version=7.1`,
    { headers, timeout: 15000 }
  )
  const repo = resp.data
  const defaultBranch = (ref ?? repo.defaultBranch ?? 'refs/heads/main').replace(/^refs\/heads\//, '')
  return {
    path: '/',
    project,
    repositoryId: repo.id as string,
    repositoryName: repo.name as string,
    defaultBranch,
  }
}

export async function listDefinitions(projectUrl: string, pat: string): Promise<PipelineDefinition[]> {
  const { org, project } = parseUrl(projectUrl)
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`
  const headers = makeHeaders(pat)

  const resp = await axios.get(
    `${base}/build/definitions?api-version=7.1&$top=500&includeAllProperties=true`,
    { headers, timeout: 20000 }
  )
  if (!Array.isArray(resp.data?.value)) {
    const contentType = String(resp.headers?.['content-type'] ?? '')
    const authHint = resp.status === 203 || !contentType.includes('application/json')
      ? ' Azure DevOps returned a sign-in/non-JSON response, which usually means the PAT is invalid, expired, or not authorized for this organization/project.'
      : ''
    throw new Error(`Azure DevOps did not return pipeline definitions.${authHint}`)
  }
  return (resp.data.value as any[])
    .map(d => {
      const yamlFilename = (d.process?.yamlFilename ?? null) as string | null
      const repositoryId = (d.repository?.id ?? '') as string
      const isYaml = d.process?.type === 2 && Boolean(yamlFilename) && Boolean(repositoryId)
      return {
        id: d.id as number,
        name: d.name as string,
        yamlFilename,
        repositoryId,
        repositoryName: (d.repository?.name ?? '') as string,
        optimizable: isYaml,
        reason: isYaml ? undefined : 'Classic or non-YAML pipeline',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchAndAnalyze(
  projectUrl: string,
  pat: string,
  definitionId: number
): Promise<AnalysisResult> {
  const { org, project } = parseUrl(projectUrl)
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`
  const headers = makeHeaders(pat)

  const defResp = await axios.get(`${base}/build/definitions/${definitionId}?api-version=7.1`, { headers, timeout: 15000 })
  const def = defResp.data

  if (def.process?.type !== 2) {
    throw new Error('This is a Classic pipeline — only YAML pipelines stored in a repo can be optimized.')
  }

  const yamlPath: string = def.process.yamlFilename
  const repositoryId: string = def.repository?.id ?? ''
  const repositoryName: string = def.repository?.name ?? ''
  const defaultBranch: string = (def.repository?.defaultBranch ?? 'refs/heads/main').replace('refs/heads/', '')
  const pipelineName: string = def.name

  const primaryContext: FileToInspect = {
    path: normalizeRepoPath(yamlPath),
    project,
    repositoryId,
    repositoryName,
    defaultBranch,
  }
  const filesToInspect: FileToInspect[] = [primaryContext]
  const seen = new Set<string>()
  const fileChanges: OptimizedFile[] = []
  const repoContextCache = new Map<string, FileToInspect>()

  for (let i = 0; i < filesToInspect.length && i < 25; i++) {
    const item = { ...filesToInspect[i], path: normalizeRepoPath(filesToInspect[i].path) }
    const key = `${item.project}:${item.repositoryId}:${item.path}`
    if (seen.has(key)) continue
    seen.add(key)

    let originalContent: string
    try {
      const itemBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(item.project)}/_apis`
      originalContent = await fetchRepoText(itemBase, headers, item.repositoryId, item.path)
    } catch {
      continue
    }

    const resources = parseRepositoryResources(originalContent)
    for (const ref of findTemplateRefs(originalContent, item.path)) {
      let next: FileToInspect = { ...item, path: ref.path }
      if (ref.alias && resources.has(ref.alias)) {
        const resource = resources.get(ref.alias)!
        const resourceProject = resource.project ?? item.project
        const cacheKey = `${resourceProject}:${resource.repositoryName}:${resource.ref ?? ''}`
        let repoContext = repoContextCache.get(cacheKey)
        if (!repoContext) {
          repoContext = await getRepositoryContext(org, resourceProject, headers, resource.repositoryName, resource.ref)
          repoContextCache.set(cacheKey, repoContext)
        }
        next = { ...repoContext, path: ref.path }
      }
      const nextKey = `${next.project}:${next.repositoryId}:${normalizeRepoPath(next.path)}`
      if (!seen.has(nextKey) && !filesToInspect.some(f => `${f.project}:${f.repositoryId}:${normalizeRepoPath(f.path)}` === nextKey)) {
        filesToInspect.push(next)
      }
    }

    const { optimizations, optimizedYaml } = applyRules(originalContent)
    fileChanges.push({
      path: item.path,
      project: item.project,
      repositoryId: item.repositoryId,
      repositoryName: item.repositoryName,
      defaultBranch: item.defaultBranch,
      originalContent,
      optimizedContent: optimizedYaml,
      optimizations,
      changed: originalContent !== optimizedYaml,
    })
  }

  const primary = fileChanges.find(f => f.repositoryId === repositoryId && f.path === normalizeRepoPath(yamlPath)) ?? fileChanges[0]
  const originalYaml = primary?.originalContent ?? ''
  const optimizedYaml = primary?.optimizedContent ?? originalYaml
  const optimizations = fileChanges.flatMap(f => f.optimizations)

  return {
    pipelineName,
    yamlPath,
    repositoryId,
    repositoryName,
    defaultBranch,
    originalYaml,
    optimizedYaml,
    fileChanges,
    optimizations,
    estimatedSavingMinutes: optimizations.reduce((s, o) => s + o.estimatedSavingMinutes, 0),
  }
}

// ─── Optimization rules ────────────────────────────────────────────────────────

type Rule = Optimization & {
  detect(yaml: string): boolean
  apply(yaml: string): string
}

const RECOMMENDATION_ONLY = new Set([
  'pp-remove-unmanaged-export',
  'pp-stable-solution-hash',
  'pp-skip-flow-toggle-when-import-skipped',
  'pp-deployment-control-parameters',
  'pbi-deploy-variable-guard',
  'parallel-env-deploy',
  'parallel-stages',
])

const RULES: Rule[] = [
  // ── Checkout optimizations ───────────────────────────────────────────────
  {
    id: 'shallow-clone',
    title: 'Shallow git clone (fetchDepth: 1)',
    description: 'Downloads only the latest commit instead of full git history. On large repos with years of commits this cuts checkout from 10–30 minutes to under 30 seconds.',
    category: 'speed',
    estimatedSavingMinutes: 20,
    confidence: 'high',
    detect: (y) => /checkout:\s*self/m.test(y) && !/fetchDepth/i.test(y),
    apply: (y) =>
      y.replace(
        /^([ \t]*)-\s*checkout:\s*self\s*$/gm,
        (_, indent) => `${indent}- checkout: self\n${indent}  fetchDepth: 1`
      ),
  },
  {
    id: 'remove-clean-checkout',
    title: 'Remove clean: true from checkout',
    description: 'clean: true wipes and re-downloads the entire workspace on every single run. Removing it lets the agent reuse cached files across runs, saving the full checkout time on repeated builds.',
    category: 'cleanup',
    estimatedSavingMinutes: 15,
    confidence: 'high',
    detect: (y) => /^\s*clean:\s*true\s*$/m.test(y),
    apply: (y) => y.replace(/^[ \t]*clean:\s*true[ \t]*\n/gm, ''),
  },
  {
    id: 'checkout-lfs',
    title: 'Disable LFS on checkout (lfs: false)',
    description: 'Git LFS pointer downloads are slow and add agent bandwidth cost on every checkout. If your repo does not store large binary assets in LFS, lfs: false is a free saving.',
    category: 'speed',
    estimatedSavingMinutes: 5,
    confidence: 'medium',
    detect: (y) => /checkout:\s*self/m.test(y) && !/lfs:/i.test(y),
    apply: (y) => injectCheckoutProp(y, 'lfs', 'false'),
  },
  {
    id: 'checkout-submodules',
    title: 'Disable submodule fetch (submodules: false)',
    description: 'Git submodule fetches recursively clone additional repos on every run. If your pipeline does not use submodules, submodules: false avoids that cost entirely.',
    category: 'speed',
    estimatedSavingMinutes: 5,
    confidence: 'medium',
    detect: (y) => /checkout:\s*self/m.test(y) && !/submodules:/i.test(y),
    apply: (y) => injectCheckoutProp(y, 'submodules', 'false'),
  },
  {
    id: 'checkout-persist-creds',
    title: 'Set persistCredentials: false on checkout',
    description: 'persistCredentials: true (the default) writes auth tokens into the git config after every checkout and then has to clean them up. Setting it to false skips that post-checkout work.',
    category: 'cleanup',
    estimatedSavingMinutes: 1,
    confidence: 'medium',
    detect: (y) => /checkout:\s*self/m.test(y) && !/persistCredentials/i.test(y),
    apply: (y) => injectCheckoutProp(y, 'persistCredentials', 'false'),
  },

  // ── Power Platform async (biggest wins for long PP pipelines) ────────────
  {
    id: 'pp-import-async',
    title: 'Async Power Platform solution import',
    description: 'Without asyncOperation: true the agent thread BLOCKS for the full import duration — often 30–90 minutes per environment. This is commonly the single largest contributor to 18-hour pipeline runtimes. Async mode submits the import and polls, preventing connection timeouts and making stage parallelism possible.',
    category: 'speed',
    estimatedSavingMinutes: 90,
    confidence: 'high',
    detect: (y) => /PowerPlatformImportSolution/i.test(y) && !/asyncOperation/i.test(y),
    apply: (y) => {
      let result = injectTaskInputProp(y, /PowerPlatformImportSolution[@\w]*/i, 'asyncOperation', 'true')
      result = injectTaskInputProp(result, /PowerPlatformImportSolution[@\w]*/i, 'maxAsyncWaitTime', "'120'")
      return result
    },
  },
  {
    id: 'pp-export-async',
    title: 'Async Power Platform solution export',
    description: 'Without asyncOperation: true the agent holds an open HTTP connection for the entire export duration. Large managed solutions can take 20–60 minutes to export and frequently cause connection timeouts, forcing re-runs. Async mode submits the export and polls until done.',
    category: 'speed',
    estimatedSavingMinutes: 45,
    confidence: 'high',
    detect: (y) => /PowerPlatformExportSolution/i.test(y) && !/asyncOperation/i.test(y),
    apply: (y) => {
      let result = injectTaskInputProp(y, /PowerPlatformExportSolution[@\w]*/i, 'asyncOperation', 'true')
      result = injectTaskInputProp(result, /PowerPlatformExportSolution[@\w]*/i, 'maxAsyncWaitTime', "'60'")
      return result
    },
  },
  {
    id: 'pp-publish-async',
    title: 'Async Power Platform publish customizations',
    description: 'PowerPlatformPublishCustomizations blocks the agent while the platform processes and propagates changes. asyncOperation: true lets the agent submit and poll rather than holding the connection open for the full publish window.',
    category: 'speed',
    estimatedSavingMinutes: 20,
    confidence: 'high',
    detect: (y) => /PowerPlatformPublishCustomizations/i.test(y) && !/asyncOperation/i.test(y),
    apply: (y) => injectTaskInputProp(y, /PowerPlatformPublishCustomizations[@\w]*/i, 'asyncOperation', 'true'),
  },
  {
    id: 'pp-skip-lower-version',
    title: 'Skip import if same/lower version (skipLowerVersion)',
    description: 'If the target environment already has the same or higher solution version, the entire import is skipped. This single flag can eliminate hours per run when the solution has not changed — one of the highest-impact settings for PP deployment pipelines.',
    category: 'speed',
    estimatedSavingMinutes: 60,
    confidence: 'high',
    detect: (y) => /PowerPlatformImportSolution/i.test(y) && !/skipLowerVersion/i.test(y),
    apply: (y) =>
      y.replace(
        /^([ \t]*-[ \t]*task:[ \t]*PowerPlatformImportSolution[^\n]*\n(?:[ \t]+(?!inputs:)[^\n]*\n)*[ \t]+inputs:\n)([ \t]+\w[^\n]*\n)/gm,
        (_, header, firstInput) => {
          const indent = firstInput.match(/^([ \t]+)/)?.[1] ?? '        '
          return `${header}${firstInput}${indent}skipLowerVersion: true\n`
        }
      ),
  },
  {
    id: 'pp-import-fast-safe-flags',
    title: 'Use faster safe Power Platform import flags',
    description: 'PowerPlatformImportSolution can skip unnecessary product dependency checks and unmanaged layer overwrite checks. This mirrors the SharedInternal speedup pattern: SkipProductUpdateDependencies true and OverwriteUnmanagedCustomizations false reduce import overhead.',
    category: 'speed',
    estimatedSavingMinutes: 20,
    confidence: 'medium',
    detect: (y) =>
      /PowerPlatformImportSolution/i.test(y) &&
      (!/SkipProductUpdateDependencies/i.test(y) || !/OverwriteUnmanagedCustomizations/i.test(y)),
    apply: (y) => {
      let result = injectTaskInputPropForEach(y, /PowerPlatformImportSolution[@\w]*/i, 'SkipProductUpdateDependencies', 'true')
      result = injectTaskInputPropForEach(result, /PowerPlatformImportSolution[@\w]*/i, 'OverwriteUnmanagedCustomizations', 'false')
      return result
    },
  },
  {
    id: 'pp-import-retry',
    title: 'Retry Power Platform imports once on transient failure',
    description: 'Long Dataverse imports can fail because of transient service or network issues. retryCountOnTaskFailure: 1 retries the task once instead of wasting a full manual rerun.',
    category: 'cleanup',
    estimatedSavingMinutes: 15,
    confidence: 'medium',
    detect: (y) => /PowerPlatformImportSolution/i.test(y) && !/retryCountOnTaskFailure/i.test(y),
    apply: (y) => injectTaskTopLevelProp(y, /PowerPlatformImportSolution[@\w]*/i, 'retryCountOnTaskFailure', '1'),
  },
  {
    id: 'pp-cache-tools',
    title: 'Cache Power Platform CLI installation',
    description: 'PowerPlatformToolInstaller downloads the full PAC CLI binary on every run. A Cache@2 task before it means the download only happens once — subsequent runs restore from cache in seconds.',
    category: 'cache',
    estimatedSavingMinutes: 15,
    confidence: 'high',
    detect: (y) => /PowerPlatformToolInstaller/i.test(y) && !/key:.*powerplatform/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache Power Platform CLI'`,
        `      inputs:`,
        `        key: 'powerplatform-tools | "$(Agent.OS)"'`,
        `        restoreKeys: |`,
        `          powerplatform-tools | "$(Agent.OS)"`,
        `        path: '$(Pipeline.Workspace)/.pac'`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*task:[ \t]*PowerPlatformToolInstaller)/im, `${block}$1`)
    },
  },

  // ── Artifact task upgrades ───────────────────────────────────────────────
  {
    id: 'upgrade-publish-artifact',
    title: 'Upgrade PublishBuildArtifacts → PublishPipelineArtifact@1',
    description: 'PublishPipelineArtifact@1 uploads artifacts 3–5× faster than the legacy PublishBuildArtifacts@1 task using a newer protocol with better compression and parallelism.',
    category: 'speed',
    estimatedSavingMinutes: 10,
    confidence: 'high',
    detect: (y) => /PublishBuildArtifacts@1/i.test(y),
    apply: (y) => y.replace(/PublishBuildArtifacts@1/gi, 'PublishPipelineArtifact@1'),
  },
  {
    id: 'upgrade-download-artifact',
    title: 'Upgrade DownloadBuildArtifacts@0 → DownloadPipelineArtifact@2',
    description: 'DownloadPipelineArtifact@2 is 2–3× faster than the legacy DownloadBuildArtifacts@0 task for downloading artifacts.',
    category: 'speed',
    estimatedSavingMinutes: 8,
    confidence: 'high',
    detect: (y) => /DownloadBuildArtifacts@0/i.test(y),
    apply: (y) => y.replace(/DownloadBuildArtifacts@0/gi, 'DownloadPipelineArtifact@2'),
  },

  // ── Caching ──────────────────────────────────────────────────────────────
  {
    id: 'publish-import-logs-rerun-safe',
    title: 'Make import log publishing safe on reruns',
    description: 'PublishPipelineArtifact can fail a rerun when the same log artifact already exists. continueOnError: true keeps reruns from failing at the final log publish step.',
    category: 'cleanup',
    estimatedSavingMinutes: 2,
    confidence: 'medium',
    detect: (y) =>
      /PublishPipelineArtifact/i.test(y) &&
      /(?:import|log|logs)/i.test(y) &&
      !/continueOnError/i.test(y),
    apply: (y) => injectTaskTopLevelProp(y, /PublishPipelineArtifact[@\w]*/i, 'continueOnError', 'true'),
  },
  {
    id: 'cache-npm',
    title: 'Cache npm packages',
    description: 'A Cache@2 task before npm install/ci skips the entire install on cache hit. Cold npm install takes 5–15 minutes; a warm cache takes under 10 seconds.',
    category: 'cache',
    estimatedSavingMinutes: 12,
    confidence: 'medium',
    detect: (y) => /npm\s+(install|ci)\b/i.test(y) && !/key:.*npm/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache npm packages'`,
        `      inputs:`,
        `        key: 'npm | "$(Agent.OS)" | **/package-lock.json,!**/node_modules/**/package-lock.json'`,
        `        restoreKeys: |`,
        `          npm | "$(Agent.OS)"`,
        `        path: $(npm_config_cache)`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*script:[ \t]*(npm\s+(install|ci)\b))/im, `${block}$1`)
    },
  },
  {
    id: 'cache-yarn',
    title: 'Cache Yarn packages',
    description: 'A Cache@2 task before yarn install skips the install on cache hit, saving 5–15 minutes per run.',
    category: 'cache',
    estimatedSavingMinutes: 12,
    confidence: 'medium',
    detect: (y) => /yarn\s+(install)?\b/i.test(y) && !/key:.*yarn/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache Yarn packages'`,
        `      inputs:`,
        `        key: 'yarn | "$(Agent.OS)" | **/yarn.lock'`,
        `        restoreKeys: |`,
        `          yarn | "$(Agent.OS)"`,
        `        path: $(YARN_CACHE_FOLDER)`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*script:[ \t]*(yarn\s+))/im, `${block}$1`)
    },
  },
  {
    id: 'cache-nuget',
    title: 'Cache NuGet packages',
    description: 'A Cache@2 task before NuGet restore prevents downloading from NuGet.org on every run. With a warm cache, restore takes seconds instead of minutes.',
    category: 'cache',
    estimatedSavingMinutes: 10,
    confidence: 'medium',
    detect: (y) => /NuGetCommand@2/i.test(y) && !/key:.*nuget/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache NuGet packages'`,
        `      inputs:`,
        `        key: 'nuget | "$(Agent.OS)" | **/packages.lock.json'`,
        `        restoreKeys: |`,
        `          nuget | "$(Agent.OS)"`,
        `        path: $(NUGET_PACKAGES)`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*task:[ \t]*NuGetCommand@2)/im, `${block}$1`)
    },
  },
  {
    id: 'cache-dotnet',
    title: 'Cache .NET restore packages',
    description: 'A Cache@2 task before dotnet restore caches ~/.nuget/packages. Avoids re-downloading from NuGet.org on every run.',
    category: 'cache',
    estimatedSavingMinutes: 10,
    confidence: 'medium',
    detect: (y) => /dotnet\s+restore\b/i.test(y) && !/key:.*dotnet/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache .NET packages'`,
        `      inputs:`,
        `        key: 'dotnet | "$(Agent.OS)" | **/*.csproj'`,
        `        restoreKeys: |`,
        `          dotnet | "$(Agent.OS)"`,
        `        path: '$(UserProfile)/.nuget/packages'`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*script:[ \t]*(dotnet\s+restore\b))/im, `${block}$1`)
    },
  },
  {
    id: 'cache-pip',
    title: 'Cache pip packages',
    description: 'A Cache@2 task before pip install prevents re-downloading Python packages from PyPI. Cold install can take 5–20 minutes; a warm cache takes seconds.',
    category: 'cache',
    estimatedSavingMinutes: 8,
    confidence: 'medium',
    detect: (y) => /pip\s+install\b/i.test(y) && !/key:.*pip/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache pip packages'`,
        `      inputs:`,
        `        key: 'pip | "$(Agent.OS)" | **/requirements*.txt'`,
        `        restoreKeys: |`,
        `          pip | "$(Agent.OS)"`,
        `        path: $(PIP_CACHE_DIR)`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*script:[ \t]*(pip\s+install\b))/im, `${block}$1`)
    },
  },
  {
    id: 'cache-maven',
    title: 'Cache Maven local repository',
    description: 'A Cache@2 task for ~/.m2/repository avoids downloading Maven dependencies on every run.',
    category: 'cache',
    estimatedSavingMinutes: 10,
    confidence: 'medium',
    detect: (y) => /\bmvn\b/i.test(y) && !/key:.*maven/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache Maven repository'`,
        `      inputs:`,
        `        key: 'maven | "$(Agent.OS)" | **/pom.xml'`,
        `        restoreKeys: |`,
        `          maven | "$(Agent.OS)"`,
        `        path: '$(HOME)/.m2/repository'`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*script:[ \t]*(mvn\b))/im, `${block}$1`)
    },
  },
  {
    id: 'cache-powershell-modules',
    title: 'Cache PowerShell modules',
    description: 'Install-Module downloads from PSGallery on every run. A Cache@2 task before the first Install-Module means subsequent runs use the cached module files.',
    category: 'cache',
    estimatedSavingMinutes: 8,
    confidence: 'medium',
    detect: (y) => /Install-Module\b/i.test(y) && !/key:.*psmodule/i.test(y),
    apply: (y) => {
      const block = [
        `    - task: Cache@2`,
        `      displayName: 'Cache PowerShell modules'`,
        `      inputs:`,
        `        key: 'psmodules | "$(Agent.OS)"'`,
        `        restoreKeys: |`,
        `          psmodules | "$(Agent.OS)"`,
        `        path: '$(System.DefaultWorkingDirectory)/.psmodules'`,
        ``,
      ].join('\n')
      return y.replace(/^([ \t]*-[ \t]*(?:task:[ \t]*PowerShell|script:|pwsh:))/im, `${block}$1`)
    },
  },

  // ── Tool version upgrades ────────────────────────────────────────────────
  {
    id: 'upgrade-nuget-installer',
    title: 'Upgrade NuGetToolInstaller@0 → @1',
    description: 'NuGetToolInstaller@1 supports faster authentication, better caching, and resolves version constraints more reliably than v0.',
    category: 'speed',
    estimatedSavingMinutes: 3,
    confidence: 'high',
    detect: (y) => /NuGetToolInstaller@0/i.test(y),
    apply: (y) => y.replace(/NuGetToolInstaller@0/gi, 'NuGetToolInstaller@1'),
  },
  {
    id: 'upgrade-use-dotnet',
    title: 'Upgrade UseDotNet@1 → @2',
    description: 'UseDotNet@2 supports global.json, faster SDK version resolution, and better caching than v1.',
    category: 'speed',
    estimatedSavingMinutes: 3,
    confidence: 'high',
    detect: (y) => /UseDotNet@1/i.test(y),
    apply: (y) => y.replace(/UseDotNet@1/gi, 'UseDotNet@2'),
  },

  // ── Cleanup / noise ──────────────────────────────────────────────────────
  {
    id: 'vsbuild-parallel',
    title: 'Enable parallel MSBuild (/m)',
    description: 'VSBuild without /m compiles projects serially. Adding msbuildArgs: /m lets MSBuild use available CPU cores, which helped the EasyRepro build in the greymatter speedup.',
    category: 'speed',
    estimatedSavingMinutes: 8,
    confidence: 'medium',
    detect: (y) => /VSBuild@/i.test(y) && !/msbuildArgs/i.test(y),
    apply: (y) => injectTaskInputPropForEach(y, /VSBuild@\d+/i, 'msbuildArgs', "'/m'"),
  },
  {
    id: 'vstest-rerun-flaky-tests',
    title: 'Retry flaky VSTest failures once',
    description: 'UI and EasyRepro tests often fail from timing or page load blips. VSTest reruns failed tests once and retries the task once on infrastructure failure, avoiding expensive manual reruns.',
    category: 'cleanup',
    estimatedSavingMinutes: 10,
    confidence: 'medium',
    detect: (y) => /VSTest@/i.test(y) && (!/rerunFailedTests/i.test(y) || !/retryCountOnTaskFailure/i.test(y)),
    apply: (y) => {
      let result = injectTaskInputPropForEach(y, /VSTest@\d+/i, 'rerunFailedTests', 'true')
      result = injectTaskInputPropForEach(result, /VSTest@\d+/i, 'rerunMaxAttempts', '1')
      result = injectTaskTopLevelProp(result, /VSTest@\d+/i, 'retryCountOnTaskFailure', '1')
      return result
    },
  },
  {
    id: 'disable-system-debug',
    title: 'Remove system.debug: true',
    description: "system.debug: true floods the pipeline with thousands of verbose diagnostic lines per step, consuming agent I/O and making logs impossible to read. It's a meaningful overhead on any pipeline — only enable when actively debugging a specific failure.",
    category: 'cleanup',
    estimatedSavingMinutes: 5,
    confidence: 'high',
    detect: (y) => /system\.debug['":\s]+true/i.test(y),
    apply: (y) => y.replace(/^[ \t]*['"]?system\.debug['"]?[:\s]+true[ \t]*\n/gim, ''),
  },
  {
    id: 'job-timeout',
    title: 'Set job timeoutInMinutes',
    description: 'Jobs without timeoutInMinutes run indefinitely when they hang — wasting agent capacity for hours until a human notices. A realistic timeout ensures stuck jobs are cancelled and the agent freed.',
    category: 'cleanup',
    estimatedSavingMinutes: 0,
    confidence: 'medium',
    detect: (y) => /^\s*-\s*job:\s*\S+/m.test(y) && !/timeoutInMinutes/i.test(y),
    apply: (y) =>
      y.replace(
        /^([ \t]*-[ \t]*job:[ \t]*\S+[ \t]*)$/gm,
        (_, jobLine) => {
          const indent = jobLine.match(/^([ \t]*)/)?.[1] ?? ''
          return `${jobLine}\n${indent}  timeoutInMinutes: 120`
        }
      ),
  },

  // ── Parallelism (recommendations — too risky to auto-apply) ─────────────
  {
    id: 'mscrm-env-vars-continue-on-error',
    title: 'Do not block build on environment variable update blips',
    description: 'MSCRMUpdateEnvironmentVariables talks to CRM during the build. A transient connectivity issue should warn instead of blocking all later deployment work.',
    category: 'cleanup',
    estimatedSavingMinutes: 5,
    confidence: 'medium',
    detect: (y) => /MSCRMUpdateEnvironmentVariables/i.test(y) && !/continueOnError/i.test(y),
    apply: (y) => injectTaskTopLevelProp(y, /MSCRMUpdateEnvironmentVariables[@\w]*/i, 'continueOnError', 'true'),
  },
  {
    id: 'pp-remove-unmanaged-export',
    title: 'Remove unused unmanaged solution export',
    description: 'The greymatter speedup removed unmanaged exports when only the managed zip was deployed. If this pipeline exports both managed and unmanaged solutions but only consumes managed artifacts, removing the unmanaged path can cut the build export job almost in half. Review artifact consumers before applying.',
    category: 'speed',
    estimatedSavingMinutes: 10,
    confidence: 'low',
    detect: (y) =>
      /PowerPlatformExportSolution/i.test(y) &&
      /(?:Managed|managed):\s*false/i.test(y) &&
      /(?:Managed|managed):\s*true/i.test(y),
    apply: (y) => y,
  },
  {
    id: 'pp-stable-solution-hash',
    title: 'Use stable solution hash to skip unchanged imports',
    description: 'Hashing the raw solution zip changes every run because Solution.xml gets stamped with a new version. Hash extracted solution contents excluding Solution.xml, then skip the import when the hash matches the last successful run. This is the pattern that cut no-change greymatter releases from hours to minutes.',
    category: 'speed',
    estimatedSavingMinutes: 120,
    confidence: 'medium',
    detect: (y) =>
      /PowerPlatformImportSolution/i.test(y) &&
      /(?:Get-FileHash|hash|shouldImportSolution|DownloadPipelineArtifact)/i.test(y) &&
      !/Solution\.xml/i.test(y),
    apply: (y) => y,
  },
  {
    id: 'pp-skip-flow-toggle-when-import-skipped',
    title: 'Skip flow toggles when solution import is skipped',
    description: 'Turn Off Flows and Turn On Flows should be conditional on the solution actually importing. Otherwise the pipeline spends minutes toggling flows during no-change releases.',
    category: 'speed',
    estimatedSavingMinutes: 6,
    confidence: 'medium',
    detect: (y) =>
      /(?:Turn[_ -]?Off[_ -]?Flows|Turn[_ -]?On[_ -]?Flows|turnOffFlows|turnOnFlows)/i.test(y) &&
      /shouldImportSolution/i.test(y) &&
      !/condition:\s*.*shouldImportSolution/i.test(y),
    apply: (y) => y,
  },
  {
    id: 'pp-deployment-control-parameters',
    title: 'Add checkbox parameters for optional deploy sections',
    description: 'Build/config data/plugins/PBIX/tests and optional solution deploys should be controlled by boolean parameters so a run can skip work it does not need. This was one of the practical greymatter speedup levers, but it needs a human-approved mapping from parameter to job.',
    category: 'speed',
    estimatedSavingMinutes: 30,
    confidence: 'low',
    detect: (y) =>
      /(?:CRM_Configuration_Data|ExportPBIXJob|EasyRepro|ExecuteTestCases|PowerBI|Plugins)/i.test(y) &&
      !/(?:build_plugins|export_config_data|deploy_pbix|run_tests|deploy_config_data)/i.test(y),
    apply: (y) => y,
  },
  {
    id: 'pbi-deploy-variable-guard',
    title: 'Guard Power BI deploys when required variables are missing',
    description: 'Power BI deploy scripts should verify tenant/app/secret/workspace variables before connecting. Missing variables should skip gracefully instead of crashing late in the release.',
    category: 'cleanup',
    estimatedSavingMinutes: 5,
    confidence: 'medium',
    detect: (y) =>
      /Connect-PowerBIServiceAccount/i.test(y) &&
      /PowerBI/i.test(y) &&
      !/(?:PowerBITenantId|PowerBIAppId|PowerBIAppSecret|WorkspaceId).*missing/i.test(y),
    apply: (y) => y,
  },
  {
    id: 'parallel-env-deploy',
    title: 'Parallelize environment deployment chain',
    description: 'This pipeline deploys to multiple environments in a strict sequence (each stage dependsOn the previous). Environments that have no functional dependency on each other (e.g., separate Test and Staging) can run in parallel by removing those intermediate dependsOn entries. For a 4-environment sequential chain this can cut total runtime by 50–70% — the single largest possible improvement on long-running PP deployment pipelines.',
    category: 'parallelism',
    estimatedSavingMinutes: 360,
    confidence: 'medium',
    detect: (y) => {
      const stageCount = (y.match(/^[ \t]*-[ \t]*stage:/gm) ?? []).length
      const depCount = (y.match(/dependsOn:/gi) ?? []).length
      return stageCount >= 3 && depCount >= 2 && /PowerPlatform/i.test(y)
    },
    apply: (y) => y,
  },
  {
    id: 'parallel-stages',
    title: 'Run independent stages in parallel',
    description: 'Stages without a dependsOn run in parallel in Azure DevOps automatically. Review the dependsOn chains — stages that share only a common build artifact (not a functional deployment dependency) can be made concurrent, cutting runtime significantly.',
    category: 'parallelism',
    estimatedSavingMinutes: 120,
    confidence: 'low',
    detect: (y) => {
      const stageCount = (y.match(/^[ \t]*-[ \t]*stage:/gm) ?? []).length
      return /^stages:/m.test(y) && /dependsOn:/i.test(y) && stageCount >= 3
    },
    apply: (y) => y,
  },
]

function applyRules(yaml: string): { optimizations: Optimization[]; optimizedYaml: string } {
  const applicable = RULES.filter(r => r.detect(yaml))
  let optimizedYaml = yaml
  for (const rule of applicable) {
    if (RECOMMENDATION_ONLY.has(rule.id)) continue
    try { optimizedYaml = rule.apply(optimizedYaml) } catch { /* skip broken apply */ }
  }
  return {
    optimizations: applicable.map(({ id, title, description, estimatedSavingMinutes, confidence, category }) => ({
      id, title, description, estimatedSavingMinutes, confidence, category,
    })),
    optimizedYaml,
  }
}

// ─── Public: analyze entire repository ────────────────────────────────────────

export async function analyzeRepository(
  projectUrl: string,
  pat: string
): Promise<RepoAnalysisResult> {
  const { org, project } = parseUrl(projectUrl)
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`
  const headers = makeHeaders(pat)

  const defs = await listDefinitions(projectUrl, pat)
  const yamlDefs = defs.filter(d => d.optimizable)

  // Fetch full definition details for all pipelines (for defaultBranch)
  const defDetails = await pConcurrent(
    yamlDefs.map(d => async () => {
      const r = await axios.get(`${base}/build/definitions/${d.id}?api-version=7.1`, { headers, timeout: 15000 })
      return r.data as any
    }),
    3
  )

  const repoContextCache = new Map<string, FileToInspect>()
  const groupMap = new Map<string, RepoOptimizationGroup>()

  const crawlTasks = yamlDefs.map((def, idx) => async (): Promise<AnalysisResult | null> => {
    const detail = defDetails[idx].ok ? (defDetails[idx] as { ok: true; value: any }).value : null
    if (!detail) return null
    const repositoryId: string = detail.repository?.id ?? def.repositoryId
    const repositoryName: string = detail.repository?.name ?? def.repositoryName
    const defaultBranch: string = (detail.repository?.defaultBranch ?? 'refs/heads/main').replace('refs/heads/', '')
    const yamlPath: string = detail.process?.yamlFilename ?? def.yamlFilename ?? ''
    if (!yamlPath) return null

    const primaryContext: FileToInspect = {
      path: normalizeRepoPath(yamlPath),
      project,
      repositoryId,
      repositoryName,
      defaultBranch,
    }
    const filesToInspect: FileToInspect[] = [primaryContext]
    const seen = new Set<string>()
    const fileChanges: OptimizedFile[] = []

    for (let i = 0; i < filesToInspect.length && i < 50; i++) {
      const item = { ...filesToInspect[i], path: normalizeRepoPath(filesToInspect[i].path) }
      const key = `${item.project}:${item.repositoryId}:${item.path}`
      if (seen.has(key)) continue
      seen.add(key)

      let originalContent: string
      try {
        const itemBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(item.project)}/_apis`
        originalContent = await fetchRepoText(itemBase, headers, item.repositoryId, item.path)
      } catch { continue }

      const resources = parseRepositoryResources(originalContent)
      for (const ref of findTemplateRefs(originalContent, item.path)) {
        let next: FileToInspect = { ...item, path: ref.path }
        if (ref.alias && resources.has(ref.alias)) {
          const resource = resources.get(ref.alias)!
          const resourceProject = resource.project ?? item.project
          const cacheKey = `${resourceProject}:${resource.repositoryName}:${resource.ref ?? ''}`
          let repoCtx = repoContextCache.get(cacheKey)
          if (!repoCtx) {
            repoCtx = await getRepositoryContext(org, resourceProject, headers, resource.repositoryName, resource.ref)
            repoContextCache.set(cacheKey, repoCtx)
          }
          next = { ...repoCtx, path: ref.path }
        }
        const nextKey = `${next.project}:${next.repositoryId}:${normalizeRepoPath(next.path)}`
        if (!seen.has(nextKey) && !filesToInspect.some(f => `${f.project}:${f.repositoryId}:${normalizeRepoPath(f.path)}` === nextKey)) {
          filesToInspect.push(next)
        }
      }

      const { optimizations, optimizedYaml } = applyRules(originalContent)
      fileChanges.push({
        path: item.path,
        project: item.project,
        repositoryId: item.repositoryId,
        repositoryName: item.repositoryName,
        defaultBranch: item.defaultBranch,
        originalContent,
        optimizedContent: optimizedYaml,
        optimizations,
        changed: originalContent !== optimizedYaml,
      })
    }

    const allOpts = fileChanges.flatMap(f => f.optimizations)
    const seenIds = new Set<string>()
    const optimizations = allOpts.filter(o => { if (seenIds.has(o.id)) return false; seenIds.add(o.id); return true })

    return {
      pipelineName: def.name,
      yamlPath,
      repositoryId,
      repositoryName,
      defaultBranch,
      originalYaml: fileChanges[0]?.originalContent ?? '',
      optimizedYaml: fileChanges[0]?.optimizedContent ?? '',
      fileChanges,
      optimizations,
      estimatedSavingMinutes: optimizations.reduce((s, o) => s + o.estimatedSavingMinutes, 0),
    }
  })

  const crawlResults = await pConcurrent(crawlTasks, 3)

  for (const r of crawlResults) {
    if (!r.ok) continue
    const result = (r as { ok: true; value: AnalysisResult | null }).value
    if (!result) continue

    if (!groupMap.has(result.repositoryId)) {
      groupMap.set(result.repositoryId, {
        repositoryId: result.repositoryId,
        repositoryName: result.repositoryName,
        defaultBranch: result.defaultBranch,
        pipelineNames: [],
        fileChanges: [],
        optimizations: [],
        estimatedSavingMinutes: 0,
      })
    }

    const group = groupMap.get(result.repositoryId)!
    group.pipelineNames.push(result.pipelineName)

    const existingPaths = new Set(group.fileChanges.map(f => `${f.project}:${f.repositoryId}:${f.path}`))
    for (const fc of result.fileChanges) {
      const k = `${fc.project}:${fc.repositoryId}:${fc.path}`
      if (!existingPaths.has(k)) { group.fileChanges.push(fc); existingPaths.add(k) }
    }
  }

  // Recompute deduplicated optimizations per group from actual fileChanges
  for (const group of groupMap.values()) {
    const seenIds = new Set<string>()
    group.optimizations = group.fileChanges
      .flatMap(f => f.optimizations)
      .filter(o => { if (seenIds.has(o.id)) return false; seenIds.add(o.id); return true })
    group.estimatedSavingMinutes = group.optimizations.reduce((s, o) => s + o.estimatedSavingMinutes, 0)
  }

  const groups = Array.from(groupMap.values())
  return {
    groups,
    totalPipelines: yamlDefs.length,
    totalFilesScanned: groups.reduce((s, g) => s + g.fileChanges.length, 0),
    totalFilesChanged: groups.reduce((s, g) => s + g.fileChanges.filter(f => f.changed).length, 0),
    totalEstimatedSavingMinutes: groups.reduce((s, g) => s + g.estimatedSavingMinutes, 0),
  }
}

// ─── Public: create PRs for all repo groups ────────────────────────────────────

export async function createRepoOptimizationPRs(
  projectUrl: string,
  pat: string,
  groups: RepoOptimizationGroup[]
): Promise<PRResult[]> {
  const results: PRResult[] = []
  for (const group of groups) {
    const changedFiles = group.fileChanges.filter(f => f.changed)
    if (changedFiles.length === 0) continue
    const pr = await createOptimizationPRSafely(
      projectUrl,
      pat,
      group.repositoryId,
      changedFiles[0].path,
      changedFiles[0].optimizedContent,
      `repo-${group.repositoryName}`,
      group.defaultBranch,
      false,
      changedFiles
    )
    results.push(pr)
  }
  return results
}

export async function createOptimizationPRSafely(
  projectUrl: string,
  pat: string,
  repositoryId: string,
  yamlPath: string,
  optimizedYaml: string,
  pipelineName: string,
  defaultBranch: string,
  dryRun = false,
  fileChanges?: OptimizedFile[]
): Promise<PRResult> {
  const { org, project } = parseUrl(projectUrl)
  const headers = makeHeaders(pat)
  const zeroObjectId = '0000000000000000000000000000000000000000'
  const allowedTargetBranches = (process.env.OPTIMIZER_TARGET_BRANCHES ?? process.env.OPTIMIZER_TARGET_BRANCH ?? 'main')
    .split(',')
    .map(b => b.trim().replace(/^refs\/heads\//, ''))
    .filter(Boolean)

  const safeName = pipelineName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const branchName = `vantage/optimize-${safeName}`
  const sourceRefName = `refs/heads/${branchName}`
  if (!safeName || !branchName.startsWith('vantage/optimize-')) {
    throw new Error('Safety stop: optimizer source branch must use the vantage/optimize-* prefix.')
  }
  if (sourceRefName === 'refs/heads/main' || sourceRefName === 'refs/heads/master') {
    throw new Error('Safety stop: optimizer will never push to main or master.')
  }

  const changedFiles = (fileChanges ?? [])
    .filter(f => f.changed && f.optimizedContent !== f.originalContent)
    .map(f => ({
      path: assertSafeOptimizerPath(f.path),
      content: f.optimizedContent,
      project: f.project ?? project,
      repositoryId: f.repositoryId ?? repositoryId,
      repositoryName: f.repositoryName ?? '',
      targetBranch: (f.defaultBranch ?? defaultBranch).replace(/^refs\/heads\//, ''),
    }))

  if (changedFiles.length === 0) {
    changedFiles.push({
      path: assertSafeOptimizerPath(yamlPath),
      content: optimizedYaml,
      project,
      repositoryId,
      repositoryName: '',
      targetBranch: defaultBranch.replace(/^refs\/heads\//, ''),
    })
  }

  const groups = new Map<string, typeof changedFiles>()
  for (const file of changedFiles) {
    if (!file.repositoryId || !file.project || typeof file.content !== 'string' || file.content.length === 0) {
      throw new Error('Safety stop: optimizer apply payload contains an invalid file change.')
    }
    const key = `${file.project}:${file.repositoryId}:${file.targetBranch}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(file)
  }

  const pullRequests: PullRequestResult[] = []

  for (const files of groups.values()) {
    const first = files[0]
    const repoBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(first.project)}/_apis`
    const targetBranch = first.targetBranch
    const targetRefName = `refs/heads/${targetBranch}`

    if (!allowedTargetBranches.includes(targetBranch)) {
      throw new Error(`Safety stop: optimizer can only target ${allowedTargetBranches.join(', ')}. Repository ${first.repositoryName || first.repositoryId} targets ${targetBranch}.`)
    }
    if (targetBranch === branchName || targetBranch.startsWith('vantage/')) {
      throw new Error('Safety stop: target branch cannot be an optimizer branch.')
    }
    if (sourceRefName === targetRefName) {
      throw new Error('Safety stop: source branch cannot equal target branch.')
    }

    const targetRefResp = await axios.get(
      `${repoBase}/git/repositories/${first.repositoryId}/refs?${new URLSearchParams({ filter: `heads/${targetBranch}`, 'api-version': '7.1' })}`,
      { headers, timeout: 15000 }
    )
    const targetRef = (targetRefResp.data.value as any[] | undefined)?.find(r => r.name === targetRefName)
    const targetObjectId = targetRef?.objectId as string | undefined
    if (!targetObjectId) {
      throw new Error(`Safety stop: could not find target branch ${targetBranch} in ${first.repositoryName || first.repositoryId}.`)
    }

    const branchRefResp = await axios.get(
      `${repoBase}/git/repositories/${first.repositoryId}/refs?${new URLSearchParams({ filter: `heads/${branchName}`, 'api-version': '7.1' })}`,
      { headers, timeout: 15000 }
    )
    const existingBranch = (branchRefResp.data.value as any[] | undefined)?.find(r => r.name === sourceRefName)
    if (existingBranch) {
      throw new Error(`Safety stop: branch ${branchName} already exists in ${first.repositoryName || first.repositoryId}. Delete it before applying again.`)
    }

    if (dryRun) {
      pullRequests.push({ prId: 0, prUrl: '', branchName, repositoryName: first.repositoryName || first.repositoryId, targetBranch, draft: true })
      continue
    }

    await axios.post(
      `${repoBase}/git/repositories/${first.repositoryId}/refs?api-version=7.1`,
      [{ name: sourceRefName, oldObjectId: zeroObjectId, newObjectId: targetObjectId }],
      { headers, timeout: 15000 }
    )

    await axios.post(
      `${repoBase}/git/repositories/${first.repositoryId}/pushes?api-version=7.1`,
      {
        refUpdates: [{ name: sourceRefName, oldObjectId: targetObjectId }],
        commits: [{
          comment: `Vantage: optimize pipeline - ${pipelineName}`,
          changes: files.map(file => ({
            changeType: 'edit',
            item: { path: file.path },
            newContent: { content: file.content, contentType: 'rawtext' },
          })),
        }],
      },
      { headers, timeout: 20000 }
    )

    const prResp = await axios.post(
      `${repoBase}/git/repositories/${first.repositoryId}/pullrequests?api-version=7.1`,
      {
        title: `Vantage: optimize pipeline - ${pipelineName}`,
        description: [
          '## Vantage Pipeline Optimizer',
          '',
          `Draft PR from ${branchName} to ${targetBranch}.`,
          '',
          `Changed files: ${files.map(f => f.path).join(', ')}`,
          '',
          'Vantage did not modify main directly. Review the diff and run the pipeline before marking this PR ready.',
        ].join('\n'),
        sourceRefName,
        targetRefName,
        isDraft: true,
      },
      { headers, timeout: 15000 }
    )

    const pr = prResp.data
    if (pr.isDraft === false) {
      throw new Error('Safety stop: Azure DevOps did not create the pull request as a draft.')
    }
    pullRequests.push({
      prId: pr.pullRequestId as number,
      prUrl: `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(first.project)}/_git/${first.repositoryId}/pullrequest/${pr.pullRequestId}`,
      branchName,
      repositoryName: first.repositoryName || first.repositoryId,
      targetBranch,
      draft: true,
    })
  }

  const firstPr = pullRequests[0]
  return {
    prId: firstPr?.prId ?? 0,
    prUrl: firstPr?.prUrl ?? '',
    branchName,
    pipelineName,
    targetBranch: firstPr?.targetBranch,
    draft: true,
    pullRequests,
  }
}
