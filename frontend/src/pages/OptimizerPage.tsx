import { useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL, apiFetch } from '../api'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'
import ConfirmActionDialog from '../components/ConfirmActionDialog'

interface PipelineDefinition {
  id: number
  name: string
  yamlFilename: string | null
  repositoryId: string
  repositoryName: string
  optimizable: boolean
  reason?: string
}

interface Optimization {
  id: string
  title: string
  description: string
  estimatedSavingMinutes: number
  confidence: 'high' | 'medium' | 'low'
  category: 'speed' | 'cache' | 'parallelism' | 'cleanup'
  applied?: boolean
}

interface OptimizedFile {
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

interface AnalysisResult {
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

interface PRResult {
  prId: number
  prUrl: string
  branchName: string
  pipelineName: string
  targetBranch?: string
  draft?: boolean
  pullRequests?: Array<{
    prId: number
    prUrl: string
    branchName: string
    repositoryName: string
    targetBranch: string
    draft: boolean
  }>
}

interface RepoOptimizationGroup {
  repositoryId: string
  repositoryName: string
  defaultBranch: string
  pipelineNames: string[]
  fileChanges: OptimizedFile[]
  optimizations: Optimization[]
  estimatedSavingMinutes: number
}

interface RepoAnalysisResult {
  groups: RepoOptimizationGroup[]
  totalPipelines: number
  totalFilesScanned: number
  totalFilesChanged: number
  totalEstimatedSavingMinutes: number
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  speed:       { label: 'Speed',       color: '#f59e0b' },
  cache:       { label: 'Cache',       color: '#60a5fa' },
  parallelism: { label: 'Parallelism', color: '#c084fc' },
  cleanup:     { label: 'Cleanup',     color: '#4ade80' },
}

const CONFIDENCE_META: Record<string, { color: string }> = {
  high:   { color: '#4ade80' },
  medium: { color: '#f59e0b' },
  low:    { color: '#94a3b8' },
}

const inputStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-mid)',
  color: 'var(--text-primary)',
  caretColor: '#f59e0b',
}

type Mode = 'single' | 'repo'

export default function OptimizerPage() {
  const [projectUrl, setProjectUrl] = useEnvironmentUrl('vtg_devops_url')
  const [loadingDefs, setLoadingDefs] = useState(false)
  const [definitions, setDefinitions] = useState<PipelineDefinition[] | null>(null)
  const [defsError, setDefsError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('single')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [showYaml, setShowYaml] = useState(false)
  const [applying, setApplying] = useState(false)
  const [pr, setPr] = useState<PRResult | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [confirmSingleOpen, setConfirmSingleOpen] = useState(false)
  // Repo-wide mode
  const [analyzingRepo, setAnalyzingRepo] = useState(false)
  const [repoAnalysis, setRepoAnalysis] = useState<RepoAnalysisResult | null>(null)
  const [repoAnalysisError, setRepoAnalysisError] = useState<string | null>(null)
  const [applyingRepo, setApplyingRepo] = useState(false)
  const [repoPRs, setRepoPRs] = useState<PRResult[] | null>(null)
  const [repoApplyError, setRepoApplyError] = useState<string | null>(null)
  const [confirmRepoOpen, setConfirmRepoOpen] = useState(false)
  async function loadDefinitions(e: React.FormEvent) {
    e.preventDefault()
    if (!projectUrl.trim()) return
    setLoadingDefs(true)
    setDefsError(null)
    setDefinitions(null)
    setSelectedId(null)
    setAnalysis(null)
    setPr(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/optimizer/definitions?projectUrl=${encodeURIComponent(projectUrl)}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Failed to load pipelines')
      setDefinitions(data.definitions)
      if (data.definitions.length === 0) setDefsError('No pipelines found in this project.')
    } catch (err) {
      setDefsError(err instanceof Error ? err.message : 'Failed to load pipelines')
    } finally {
      setLoadingDefs(false)
    }
  }

  async function analyze() {
    if (!selectedId) return
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysis(null)
    setPr(null)
    setShowYaml(false)
    try {
      const endpoint = `${API_URL}/api/optimizer/ai-analyze?projectUrl=${encodeURIComponent(projectUrl)}&definitionId=${selectedId}`
      const resp = await apiFetch(endpoint)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Analysis failed')
      setAnalysis(data)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function applyOptimizations() {
    if (!analysis) return
    setApplying(true)
    setApplyError(null)
    setPr(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/optimizer/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUrl,
          repositoryId: analysis.repositoryId,
          yamlPath: analysis.yamlPath,
          optimizedYaml: analysis.optimizedYaml,
          pipelineName: analysis.pipelineName,
          defaultBranch: analysis.defaultBranch,
          fileChanges: analysis.fileChanges,
          safetyAcknowledged: true,
          createDraftOnly: true,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Failed to create PR')
      setPr(data)
      setConfirmSingleOpen(false)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to create PR')
    } finally {
      setApplying(false)
    }
  }

  async function analyzeRepo() {
    setAnalyzingRepo(true)
    setRepoAnalysisError(null)
    setRepoAnalysis(null)
    setRepoPRs(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/optimizer/analyze-repo?projectUrl=${encodeURIComponent(projectUrl)}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Repository analysis failed')
      setRepoAnalysis(data)
    } catch (err) {
      setRepoAnalysisError(err instanceof Error ? err.message : 'Repository analysis failed')
    } finally {
      setAnalyzingRepo(false)
    }
  }

  async function applyRepo() {
    if (!repoAnalysis) return
    const changedGroups = repoAnalysis.groups.filter(g => g.fileChanges.some(f => f.changed))
    if (changedGroups.length === 0) return
    setApplyingRepo(true)
    setRepoApplyError(null)
    setRepoPRs(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/optimizer/apply-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUrl,
          groups: changedGroups,
          safetyAcknowledged: true,
          createDraftOnly: true,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Failed to create PRs')
      setRepoPRs(data.pullRequests)
      setConfirmRepoOpen(false)
    } catch (err) {
      setRepoApplyError(err instanceof Error ? err.message : 'Failed to create PRs')
    } finally {
      setApplyingRepo(false)
    }
  }

  const filteredDefs = (definitions ?? []).filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )
  const selectedDef = definitions?.find(d => d.id === selectedId) ?? null
  const changedFiles = analysis?.fileChanges?.filter(f => f.changed) ?? []
  const hasChanges = changedFiles.length > 0 || (analysis?.optimizations?.length ?? 0) > 0
  const changedRepoGroups = repoAnalysis?.groups.filter(g => g.fileChanges.some(f => f.changed)) ?? []
  const repoOptimizationCount = changedRepoGroups.reduce((total, group) => total + group.optimizations.length, 0)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.45), transparent)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: '#f59e0b' }}>
            Feature 07
          </p>
          <h1 className="font-display font-semibold leading-tight text-gradient"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            Pipeline Optimizer
          </h1>
          <p className="text-sm mt-3 max-w-lg" style={{ color: 'var(--text-secondary)' }}>
            Automatically applies every known optimization to any YAML pipeline — shallow clones, missing caches, async PP operations, stage parallelism, and more — then ships all fixes as a draft PR without touching main.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">

        {/* Step 1 — Connect */}
        <form onSubmit={loadDefinitions}
          className="relative rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)' }} />
          <div className="px-6 py-6 space-y-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                Azure DevOps Project URL
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Same URL you see in your browser on the Pipelines page.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="url"
                placeholder="https://dev.azure.com/your-org/your-project"
                value={projectUrl}
                onChange={e => setProjectUrl(e.target.value)}
                required
                disabled={loadingDefs}
                className="flex-1 rounded-lg px-4 py-3 text-sm transition-all focus:outline-none disabled:opacity-40"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <button
                type="submit"
                disabled={loadingDefs || !projectUrl.trim()}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ backgroundColor: '#b45309', color: '#fff', boxShadow: '0 0 20px rgba(180,83,9,0.25)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#d97706' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#b45309' }}
              >
                {loadingDefs
                  ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Loading…</>
                  : 'Load Pipelines'}
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: '#f59e0b' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                PAT needs <strong style={{ color: 'var(--text-secondary)' }}>Build (Read)</strong> to load pipelines and <strong style={{ color: 'var(--text-secondary)' }}>Code (Read &amp; Write)</strong> to create branches and PRs.
              </p>
            </div>
          </div>
        </form>

        {/* Error */}
        {defsError && (
          <div className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
            <p className="text-sm font-semibold mb-1">Could not load pipelines</p>
            <p className="text-xs opacity-80">{defsError}</p>
          </div>
        )}

        {/* Mode toggle */}
        {definitions && definitions.length > 0 && (
          <div className="flex gap-1 p-1 rounded-xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {([['single', 'Single Pipeline'], ['repo', 'Entire Repository']] as [Mode, string][]).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: mode === m ? '#b45309' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  boxShadow: mode === m ? '0 0 16px rgba(180,83,9,0.2)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Select pipeline */}
        {definitions && definitions.length > 0 && mode === 'single' && (
          <div className="relative rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.35), transparent)' }} />

            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                  Select Pipeline
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {definitions.filter(d => d.optimizable).length} YAML pipelines found
                </p>
              </div>
              {/* Search */}
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search pipelines…"
                  className="text-xs bg-transparent outline-none w-44"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* List */}
            <div
              style={{ maxHeight: 320, overflowY: 'scroll' }}
              onWheel={e => { e.stopPropagation(); (e.currentTarget as HTMLDivElement).scrollTop += e.deltaY }}
            >
              {filteredDefs.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pipelines match "{search}"</p>
                </div>
              ) : (
                filteredDefs.map((d, i) => {
                  const isSelected = selectedId === d.id
                  return (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedId(d.id); setAnalysis(null); setPr(null) }}
                      className="w-full text-left transition-colors duration-100"
                      style={{
                        borderBottom: i < filteredDefs.length - 1 ? '1px solid var(--border)' : undefined,
                        backgroundColor: isSelected ? 'rgba(245,158,11,0.06)' : 'transparent',
                        borderLeft: `3px solid ${isSelected ? '#f59e0b' : 'transparent'}`,
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                    >
                      <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: isSelected ? '#f59e0b' : 'var(--text-primary)' }}>
                            {isSelected && (
                              <svg className="w-3 h-3 inline-block mr-1.5 mb-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            {d.name}
                          </p>
                          {d.yamlFilename && (
                            <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'var(--text-muted)' }}>{d.yamlFilename}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                          style={{
                            backgroundColor: d.optimizable ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.08)',
                            border: `1px solid ${d.optimizable ? 'rgba(74,222,128,0.25)' : 'rgba(148,163,184,0.15)'}`,
                            color: d.optimizable ? '#4ade80' : '#64748b',
                          }}>
                          {d.optimizable ? 'YAML' : 'Classic'}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer — selected + analyze */}
            {selectedId && (
              <div className="px-6 py-4 flex items-center justify-between gap-4"
                style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(245,158,11,0.03)' }}>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-0.5" style={{ color: '#f59e0b' }}>Selected</p>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{selectedDef?.name}</p>
                  {!selectedDef?.optimizable && (
                    <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>Classic pipeline — cannot be optimized</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={analyze}
                    disabled={analyzing || !selectedDef?.optimizable}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{ backgroundColor: '#6d28d9', color: '#fff', boxShadow: '0 0 16px rgba(109,40,217,0.25)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#7c3aed' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#6d28d9' }}
                  >
                    {analyzing ? (
                      <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Analyzing…</>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        Analyze Pipeline
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis error */}
        {analyzing && (
          <div className="rounded-xl px-5 py-4 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <span className="w-4 h-4 rounded-full border-2 shrink-0 animate-spin"
              style={{ borderColor: 'rgba(167,139,250,0.3)', borderTopColor: '#a78bfa' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Analyzing pipeline…</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Applying all optimization rules, then using AI to handle stage parallelism. Takes 30–90 seconds.
              </p>
            </div>
          </div>
        )}

        {analysisError && mode === 'single' && (
          <div className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
            <p className="text-sm font-semibold mb-1">Analysis failed</p>
            <p className="text-xs opacity-80">{analysisError}</p>
          </div>
        )}

        {/* ── Repo-wide mode ─────────────────────────────────────────────── */}
        {definitions && definitions.length > 0 && mode === 'repo' && (
          <div className="relative rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)' }} />
            <div className="px-6 py-6 flex items-center justify-between gap-6">
              <div>
                <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                  Optimize Entire Repository
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Scans all {definitions.filter(d => d.optimizable).length} YAML pipelines, crawls every template file they reference,
                  deduplicates files across pipelines, and applies all {'{'}20+{'}'} optimization rules across the whole codebase.
                  One draft PR per repository — main is never touched.
                </p>
              </div>
              <button
                onClick={analyzeRepo}
                disabled={analyzingRepo}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                style={{ backgroundColor: '#b45309', color: '#fff', boxShadow: '0 0 20px rgba(180,83,9,0.25)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#d97706' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#b45309' }}>
                {analyzingRepo
                  ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Scanning…</>
                  : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>Scan Repository</>
                }
              </button>
            </div>
            {analyzingRepo && (
              <div className="px-6 pb-5">
                <div className="rounded-lg px-4 py-3 text-xs flex items-center gap-3"
                  style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', color: '#f59e0b' }}>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-800 border-t-amber-400 animate-spin shrink-0" />
                  Crawling all pipelines and their template files — this may take 30–60 seconds depending on how many pipelines and templates exist…
                </div>
              </div>
            )}
          </div>
        )}

        {repoAnalysisError && (
          <div className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
            <p className="text-sm font-semibold mb-1">Repository scan failed</p>
            <p className="text-xs opacity-80">{repoAnalysisError}</p>
          </div>
        )}

        {repoAnalysis && mode === 'repo' && (
          <>
            {/* Repo-wide stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Pipelines Scanned" value={String(repoAnalysis.totalPipelines)} sub="YAML pipelines" accent="#f59e0b" />
              <StatCard label="Files Changed" value={String(repoAnalysis.totalFilesChanged)} sub={`of ${repoAnalysis.totalFilesScanned} scanned`} accent="#60a5fa" />
              <StatCard label="Est. Savings" value={repoAnalysis.totalEstimatedSavingMinutes >= 60
                ? `−${Math.round(repoAnalysis.totalEstimatedSavingMinutes / 60)}h ${repoAnalysis.totalEstimatedSavingMinutes % 60}m`
                : `−${repoAnalysis.totalEstimatedSavingMinutes} min`}
                sub="per run across all pipelines" accent="#4ade80" />
              <StatCard label="Repositories" value={String(repoAnalysis.groups.length)} sub="draft PRs will be created" accent="#c084fc" />
            </div>

            {/* Per-repo groups */}
            {repoAnalysis.groups.map(group => {
              const groupChangedFiles = group.fileChanges.filter(f => f.changed)
              return (
                <div key={group.repositoryId} className="relative rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }} />
                  {/* Header */}
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                          {group.repositoryName}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {group.pipelineNames.length} pipeline{group.pipelineNames.length !== 1 ? 's' : ''} · {groupChangedFiles.length} file{groupChangedFiles.length !== 1 ? 's' : ''} changed · branch <code className="font-mono" style={{ color: '#f59e0b' }}>vantage/optimize-repo-{group.repositoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</code> → <code className="font-mono" style={{ color: '#60a5fa' }}>{group.defaultBranch}</code>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-display font-bold" style={{ color: '#4ade80' }}>
                          {group.estimatedSavingMinutes >= 60
                            ? `−${Math.floor(group.estimatedSavingMinutes / 60)}h ${group.estimatedSavingMinutes % 60}m`
                            : `−${group.estimatedSavingMinutes}m`}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>per run</p>
                      </div>
                    </div>
                  </div>
                  {/* Optimizations */}
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {group.optimizations.slice(0, 6).map(opt => {
                      const cat = CATEGORY_META[opt.category] ?? { label: opt.category, color: '#94a3b8' }
                      const conf = CONFIDENCE_META[opt.confidence] ?? { color: '#94a3b8' }
                      return (
                        <div key={opt.id} className="px-6 py-3.5 flex items-center justify-between gap-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                style={{ backgroundColor: cat.color + '18', color: cat.color, border: `1px solid ${cat.color}30` }}>
                                {cat.label}
                              </span>
                              <span className="flex items-center gap-1 text-xs" style={{ color: conf.color }}>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: conf.color }} />
                                {opt.confidence}
                              </span>
                              {opt.applied && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                  style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                                  applied
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.title}</p>
                          </div>
                          {opt.estimatedSavingMinutes > 0 && (
                            <p className="text-base font-display font-bold shrink-0" style={{ color: '#4ade80' }}>
                              −{opt.estimatedSavingMinutes}m
                            </p>
                          )}
                        </div>
                      )
                    })}
                    {group.optimizations.length > 6 && (
                      <div className="px-6 py-3">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          +{group.optimizations.length - 6} more optimization{group.optimizations.length - 6 !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Changed files */}
                  {groupChangedFiles.length > 0 && (
                    <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(245,158,11,0.02)' }}>
                      <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Files to change</p>
                      <div className="space-y-1">
                        {groupChangedFiles.map(f => (
                          <p key={f.path} className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{f.path}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Apply all button */}
            {repoAnalysis.totalFilesChanged > 0 && !repoPRs && (
              <div className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent)' }} />
                <div className="px-6 py-5 flex items-center justify-between gap-6">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                      Apply All &amp; Create Draft PRs
                    </h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Creates {repoAnalysis.groups.filter(g => g.fileChanges.some(f => f.changed)).length} branch{repoAnalysis.groups.filter(g => g.fileChanges.some(f => f.changed)).length !== 1 ? 'es' : ''} and opens draft PRs with all {repoAnalysis.totalFilesChanged} file changes in a single commit per repo. Main is never touched.
                    </p>
                    {repoApplyError && <p className="mt-1.5 text-xs" style={{ color: '#f87171' }}>{repoApplyError}</p>}
                  </div>
                  <button
                    onClick={() => setConfirmRepoOpen(true)}
                    disabled={applyingRepo}
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                    style={{ backgroundColor: '#14532d', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', boxShadow: '0 0 20px rgba(74,222,128,0.08)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#166534' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#14532d' }}>
                    {applyingRepo
                      ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-green-800 border-t-green-400 animate-spin" />Creating PRs…</>
                      : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>Apply All Repos</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* PR results */}
            {repoPRs && repoPRs.length > 0 && (
              <div className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent)' }} />
                <div className="px-6 py-5">
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: '#4ade80' }}>
                    {repoPRs.length} Draft PR{repoPRs.length !== 1 ? 's' : ''} Created
                  </p>
                  <Link to="/audit-log" className="inline-flex text-xs font-semibold mb-3 transition-opacity hover:opacity-80" style={{ color: '#4ade80' }}>
                    View Audit Log
                  </Link>
                  <div className="space-y-2">
                    {repoPRs.map(pr => (
                      <div key={pr.branchName} className="flex items-center justify-between gap-4 rounded-lg px-4 py-3"
                        style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{pr.branchName}</p>
                          <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>→ {pr.targetBranch}</p>
                        </div>
                        <a href={pr.prUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          style={{ color: '#4ade80' }}>
                          Open PR #{pr.prId}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 3 — Analysis results */}
        {analysis && mode === 'single' && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Est. Time Saved"
                value={analysis.estimatedSavingMinutes > 0 ? `−${analysis.estimatedSavingMinutes} min` : '—'}
                sub="per run"
                accent="#4ade80"
              />
              <StatCard
                label="Optimizations"
                value={String(analysis.optimizations.length)}
                sub="improvements found"
                accent="#f59e0b"
              />
              <StatCard
                label="Files Changed"
                value={String(changedFiles.length)}
                sub={`of ${analysis.fileChanges?.length ?? 1} scanned`}
                accent="#60a5fa"
              />
              <StatCard
                label="Target Branch"
                value={analysis.defaultBranch}
                sub={analysis.repositoryName}
                accent="#c084fc"
                mono
              />
            </div>

            {changedFiles.length > 0 && (
              <div className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                    Files Vantage Would Change
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Cross-repo changes create separate draft PRs per repository.
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {changedFiles.map(file => (
                    <div key={`${file.project}:${file.repositoryId}:${file.path}`} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{file.path}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {file.project} / {file.repositoryName}
                        </p>
                      </div>
                      <span className="text-xs shrink-0" style={{ color: '#f59e0b' }}>
                        {file.optimizations.length} optimization{file.optimizations.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimizations list */}
            <div className="relative rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }} />

              <div className="px-6 py-5 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                    Optimizations — {analysis.pipelineName}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {analysis.yamlPath} · {analysis.repositoryName}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0"
                  style={{ backgroundColor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  AI Enhanced
                </span>
              </div>

              {analysis.optimizations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Already well-optimized</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No automatic improvements detected.</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {analysis.optimizations.map(opt => {
                    const cat = CATEGORY_META[opt.category] ?? { label: opt.category, color: '#94a3b8' }
                    const conf = CONFIDENCE_META[opt.confidence] ?? { color: '#94a3b8' }
                    return (
                      <div key={opt.id} className="px-6 py-4 flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{ backgroundColor: cat.color + '18', color: cat.color, border: `1px solid ${cat.color}30` }}>
                              {cat.label}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs" style={{ color: conf.color }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: conf.color }} />
                              {opt.confidence.charAt(0).toUpperCase() + opt.confidence.slice(1)} confidence
                            </span>
                            {opt.applied
                              ? (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                  style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                                  applied
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded"
                                  style={{ backgroundColor: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                                  review manually
                                </span>
                              )
                            }
                          </div>
                          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{opt.title}</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{opt.description}</p>
                        </div>
                        {opt.estimatedSavingMinutes > 0 && (
                          <div className="text-right shrink-0">
                            <p className="text-xl font-display font-bold" style={{ color: '#4ade80' }}>−{opt.estimatedSavingMinutes}m</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>per run</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* YAML toggle */}
              {hasChanges && (
                <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setShowYaml(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ color: '#f59e0b' }}>
                    <svg className="w-3 h-3 transition-transform" style={{ transform: showYaml ? 'rotate(90deg)' : 'none' }}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    {showYaml ? 'Hide' : 'View'} optimized YAML
                  </button>
                  {showYaml && (
                    <pre className="mt-3 p-4 rounded-xl text-xs font-mono leading-relaxed overflow-auto"
                      style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)', maxHeight: 400, whiteSpace: 'pre' }}>
                      {analysis.optimizedYaml}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Apply */}
            {hasChanges && !pr && (
              <div className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)' }} />
                <div className="px-6 py-5 flex items-center justify-between gap-6">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                      Apply &amp; Create Draft PR
                    </h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Creates branch <code className="font-mono" style={{ color: '#f59e0b' }}>vantage/optimize-…</code> and opens a draft PR to <code className="font-mono" style={{ color: '#60a5fa' }}>{analysis.defaultBranch}</code>. Main is never touched.
                    </p>
                    {applyError && (
                      <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{applyError}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmSingleOpen(true)}
                    disabled={applying}
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{ backgroundColor: '#14532d', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', boxShadow: '0 0 20px rgba(74,222,128,0.08)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#166534' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#14532d' }}
                  >
                    {applying ? (
                      <><span className="w-3.5 h-3.5 rounded-full border-2 border-green-800 border-t-green-400 animate-spin" />Creating PR…</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>Apply &amp; Create Draft PR</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* PR result */}
            {pr && (
              <div className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent)' }} />
                <div className="px-6 py-5 flex items-center justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: '#4ade80' }}>Draft PR Created</p>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{pr.pipelineName}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {pr.branchName} → {analysis.defaultBranch}
                    </p>
                    <Link to="/audit-log" className="inline-flex text-xs font-semibold mt-2 transition-opacity hover:opacity-80" style={{ color: '#4ade80' }}>
                      View Audit Log
                    </Link>
                  </div>
                  <a
                    href={pr.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all whitespace-nowrap"
                    style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.12)'}
                  >
                    Open PR #{pr.prId}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        <ConfirmActionDialog
          open={confirmSingleOpen}
          title="Create Optimizer Draft PR"
          tone="info"
          confirmLabel="Create Draft PR"
          isWorking={applying}
          body="Vantage will create a new optimizer branch and open a draft PR. The target branch is not modified directly."
          checkLabel="I understand this will create a branch and draft PR in Azure DevOps."
          details={analysis ? [
            { label: 'Project', value: projectUrl.trim() },
            { label: 'Repository', value: analysis.repositoryName },
            { label: 'Pipeline', value: analysis.pipelineName },
            { label: 'Target', value: analysis.defaultBranch },
            { label: 'Files', value: `${changedFiles.length}` },
            { label: 'Optimizations', value: `${analysis.optimizations.length}` },
            { label: 'Savings', value: analysis.estimatedSavingMinutes > 0 ? `${analysis.estimatedSavingMinutes} min per run` : 'n/a' },
            { label: 'PR Mode', value: 'Draft only' },
          ] : []}
          onCancel={() => setConfirmSingleOpen(false)}
          onConfirm={applyOptimizations}
        />

        <ConfirmActionDialog
          open={confirmRepoOpen}
          title="Create Repository Optimizer PRs"
          tone="info"
          confirmLabel="Create Draft PRs"
          isWorking={applyingRepo}
          body="Vantage will create one optimizer branch and draft PR per changed repository. Target branches are not modified directly."
          checkLabel="I understand this will create branches and draft PRs in Azure DevOps."
          details={repoAnalysis ? [
            { label: 'Project', value: projectUrl.trim() },
            { label: 'Repositories', value: `${changedRepoGroups.length}` },
            { label: 'Pipelines', value: `${repoAnalysis.totalPipelines}` },
            { label: 'Files', value: `${repoAnalysis.totalFilesChanged}` },
            { label: 'Optimizations', value: `${repoOptimizationCount}` },
            { label: 'Savings', value: repoAnalysis.totalEstimatedSavingMinutes > 0 ? `${repoAnalysis.totalEstimatedSavingMinutes} min per run` : 'n/a' },
            { label: 'Target', value: [...new Set(changedRepoGroups.map(group => group.defaultBranch))].join(', ') || 'n/a' },
            { label: 'PR Mode', value: 'Draft only' },
          ] : []}
          onCancel={() => setConfirmRepoOpen(false)}
          onConfirm={applyRepo}
        />
      </main>
    </>
  )
}

function StatCard({ label, value, sub, accent, mono }: {
  label: string; value: string; sub: string; accent: string; mono?: boolean
}) {
  return (
    <div className="relative rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className={`text-2xl font-display font-bold mb-0.5 ${mono ? 'font-mono text-base' : ''}`} style={{ color: accent }}>
          {value}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
    </div>
  )
}
