import axios from 'axios'
import type { AppliedOptimization } from './optimizer'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

export type AIChange = AppliedOptimization

export interface AIOptimizationResult {
  optimizedYaml: string
  changes: AIChange[]
}

export interface MergedAIOptimizations {
  optimizations: AppliedOptimization[]
  estimatedSavingMinutes: number
}

export function mergeAIOptimizations(
  baseOptimizations: AppliedOptimization[],
  aiChanges: AppliedOptimization[]
): MergedAIOptimizations {
  const baseTotal = baseOptimizations.reduce((sum, item) => sum + item.estimatedSavingMinutes, 0)
  const hasRuleParallelismBaseline = baseOptimizations.some(item => item.category === 'parallelism')

  // AI decisions usually confirm and safely apply a parallelism opportunity that the
  // rule engine already estimated. Keep the original finding so AI mode never loses
  // baseline coverage, but do not count the same saving twice.
  const normalizedAIChanges = aiChanges.map(change => ({
    ...change,
    title: `AI confirmed: ${change.title}`,
    description: hasRuleParallelismBaseline
      ? `${change.description} The estimated saving is already included in the rule-engine parallelism baseline.`
      : change.description,
    estimatedSavingMinutes: hasRuleParallelismBaseline ? 0 : change.estimatedSavingMinutes,
  }))

  return {
    optimizations: [...baseOptimizations, ...normalizedAIChanges],
    estimatedSavingMinutes: baseTotal + normalizedAIChanges.reduce((sum, item) => sum + item.estimatedSavingMinutes, 0),
  }
}

interface ParallelDecision {
  stage: string
  setDependsOn: string[]   // complete new dependsOn list; [] = no deps (runs immediately in parallel)
  reason: string
  savingMinutes: number
}

interface AIParallelResponse {
  decisions: ParallelDecision[]
}

function extractStageStructure(yaml: string): string {
  const lines = yaml.split('\n')
  const relevant: string[] = []
  let inStages = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'stages:') { inStages = true; continue }
    if (inStages && (
      trimmed.startsWith('- stage:') ||
      trimmed.startsWith('displayName:') ||
      trimmed.startsWith('dependsOn:') ||
      trimmed.match(/^-\s+\w/)
    )) {
      relevant.push(line)
    }
    if (inStages && trimmed.startsWith('jobs:')) inStages = false
  }

  return relevant.length > 0 ? relevant.join('\n') : yaml.slice(0, 2000)
}

function setStageDepends(yaml: string, stageName: string, newDeps: string[]): string {
  const lines = yaml.split('\n')
  const out: string[] = []
  let inTarget = false, stageIndent = -1, replaced = false, skipArray = false, skipIndent = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (skipArray) {
      const li = (line.match(/^([ \t]*)/) || ['', ''])[1].length
      if (!line.trim()) { out.push(line); continue }
      if (li > skipIndent && line.trimStart().startsWith('-')) continue
      else skipArray = false
    }
    const sm = line.match(/^([ \t]*)- stage:\s*(\S+)/)
    if (sm) {
      inTarget = sm[2] === stageName; stageIndent = sm[1].length; replaced = false
      out.push(line); continue
    }
    if (inTarget && !replaced) {
      const li = (line.match(/^([ \t]*)/) || ['', ''])[1].length
      if (line.trim() && li <= stageIndent) { inTarget = false; out.push(line); continue }
      const single = line.match(/^([ \t]*)dependsOn:\s+\S/)
      if (single) {
        const ind = single[1]
        if (newDeps.length === 0) out.push(`${ind}dependsOn: []`)
        else if (newDeps.length === 1) out.push(`${ind}dependsOn: ${newDeps[0]}`)
        else { out.push(`${ind}dependsOn:`); for (const d of newDeps) out.push(`${ind}  - ${d}`) }
        replaced = true; continue
      }
      const arr = line.match(/^([ \t]*)dependsOn:\s*$/)
      if (arr) {
        const ind = arr[1]
        if (newDeps.length === 0) out.push(`${ind}dependsOn: []`)
        else if (newDeps.length === 1) out.push(`${ind}dependsOn: ${newDeps[0]}`)
        else { out.push(`${ind}dependsOn:`); for (const d of newDeps) out.push(`${ind}  - ${d}`) }
        replaced = true; skipArray = true; skipIndent = ind.length; continue
      }
    }
    out.push(line)
  }
  return out.join('\n')
}

function applyParallelDecisions(yaml: string, decisions: ParallelDecision[]): string {
  let result = yaml
  for (const decision of decisions) {
    if (!Array.isArray(decision.setDependsOn)) continue
    result = setStageDepends(result, decision.stage, decision.setDependsOn)
  }
  return result
}

const SYSTEM_PROMPT = `You are an Azure DevOps pipeline optimizer specializing in stage parallelism.

You will be given the current stage structure of a pipeline (possibly already partially optimized by a rule engine). Your job is to find stages whose dependsOn should be changed to unlock parallelism, and return the complete NEW dependsOn list for each such stage.

Rules:
- Return "setDependsOn: []" only if the stage truly needs NO previous stage (runs immediately at pipeline start).
- Return "setDependsOn: ["Build"]" when an environment-deploy stage should skip intermediate deploy stages and depend only on the artifact-publishing stage.
- The final gate stage (e.g. DeployProd) must depend on ALL parallel stages that precede it.
- Do NOT change a stage that is already correctly configured.
- Do NOT remove a dependency on a stage that produces artifacts (solutions, binaries) this stage needs.
- Only include a stage in decisions if you are confident the change is safe.
- Stage names must match exactly (case-sensitive).

Return ONLY this JSON (no markdown, no explanation):
{
  "decisions": [
    {
      "stage": "ExactStageName",
      "setDependsOn": ["StageName1", "StageName2"],
      "reason": "One sentence explaining why this is safe",
      "savingMinutes": 30
    }
  ]
}

Example — turning Build→Test→Staging→Prod (sequential) into parallel:
- DeployTest: already has setDependsOn: ["Build"] — no change
- DeployStaging: setDependsOn: ["Build"]  (was: ["DeployTest"])
- DeployProd: setDependsOn: ["DeployTest", "DeployStaging"]  (was: ["DeployStaging"])`

export async function explainFlowError(flowName: string, errorMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error('GROQ_API_KEY is not set in .env')

  const resp = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a Power Platform expert. When given a cloud flow name and its error message, explain in plain English what went wrong and give 2-3 specific steps to fix it. Be concise and practical. Do not use jargon. Format: one paragraph explaining the cause, then a numbered list of fix steps.`,
        },
        {
          role: 'user',
          content: `Flow name: ${flowName}\n\nError: ${errorMessage}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 512,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  )

  return resp.data.choices?.[0]?.message?.content ?? 'No explanation returned.'
}

export async function analyzeWithAI(
  originalYaml: string,
  parallelismHints: { title: string; description: string; estimatedSavingMinutes: number }[]
): Promise<AIOptimizationResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error('GROQ_API_KEY is not set in .env')

  const stageStructure = extractStageStructure(originalYaml)

  const hintsText = parallelismHints.length > 0
    ? `\n\nRule engine already identified these parallelism opportunities:\n${parallelismHints.map((h, i) => `${i + 1}. ${h.title} (saves ~${h.estimatedSavingMinutes}m): ${h.description}`).join('\n')}`
    : ''

  const resp = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Current pipeline stage structure (already partially optimized):${hintsText}\n\n${stageStructure}\n\nReturn JSON decisions for stages whose dependsOn should change to unlock parallelism:` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  )

  const content: string = resp.data.choices?.[0]?.message?.content ?? ''
  const stripped = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)

  if (!jsonMatch) throw new Error('AI returned no valid JSON — try again')

  let parsed: AIParallelResponse
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('AI returned malformed JSON — try again')
  }

  if (!Array.isArray(parsed.decisions)) parsed.decisions = []

  const optimizedYaml = parsed.decisions.length > 0
    ? applyParallelDecisions(originalYaml, parsed.decisions)
    : originalYaml

  const changes: AIChange[] = parsed.decisions
    .filter(d => Array.isArray(d.setDependsOn))
    .map((d, i) => ({
      id: `ai-parallel-${i + 1}`,
      title: `Parallelize ${d.stage}`,
      description: d.reason,
      estimatedSavingMinutes: typeof d.savingMinutes === 'number'
        ? Math.max(0, Math.min(720, d.savingMinutes))
        : 30,
      confidence: 'high' as const,
      category: 'parallelism' as const,
      applied: true,
    }))

  return { optimizedYaml, changes }
}
