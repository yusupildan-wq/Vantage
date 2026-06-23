import axios from 'axios'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

export interface AIChange {
  id: string
  title: string
  description: string
  estimatedSavingMinutes: number
  confidence: 'high' | 'medium' | 'low'
  category: 'speed' | 'cache' | 'parallelism' | 'cleanup'
}

export interface AIOptimizationResult {
  optimizedYaml: string
  changes: AIChange[]
}

interface ParallelDecision {
  stage: string
  removeDependsOn: string[]
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

function applyParallelDecisions(yaml: string, decisions: ParallelDecision[]): string {
  let result = yaml

  const depsToRemove = new Set<string>()
  for (const decision of decisions) {
    for (const dep of decision.removeDependsOn) depsToRemove.add(dep)
    depsToRemove.add(decision.stage)
  }

  for (const dep of depsToRemove) {
    const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\n([ \\t]*)dependsOn:\\s*${escaped}\\s*(?=\\n)`, 'gi'), '')
    result = result.replace(new RegExp(`\\n[ \\t]*-\\s*${escaped}\\s*(?=\\n)`, 'gi'), '')
  }

  result = result.replace(/\n[ \t]*dependsOn:\s*\n(?=[ \t]*(?:pool:|jobs:|steps:|condition:|variables:|-\s*stage:))/g, '\n')
  result = result.replace(/\n[ \t]*dependsOn:\s*\[\s*\]\s*\n/g, '\n')

  return result
}

const SYSTEM_PROMPT = `You are an Azure DevOps pipeline optimizer. You will be given a pipeline's stage structure and a list of parallelism improvements already identified by a rule engine.

Your job: confirm which of these improvements are safe and return the specific dependsOn entries to remove.

Return ONLY this JSON (no markdown, no explanation):
{
  "decisions": [
    {
      "stage": "ExactStageName",
      "removeDependsOn": ["ExactDependencyName"],
      "reason": "One sentence why this is safe to parallelize",
      "savingMinutes": 30
    }
  ]
}

Only include a decision if you are confident the stages are truly independent (no shared artifacts, no logical ordering requirement). If unsure, omit it. Stage names must match exactly.`

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
        { role: 'user', content: `Pipeline stage structure:${hintsText}\n\n${stageStructure}\n\nReturn JSON decisions for which dependsOn entries to remove:` },
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

  const changes: AIChange[] = parsed.decisions.map((d, i) => ({
    id: `ai-parallel-${i + 1}`,
    title: `Parallelize ${d.stage}`,
    description: d.reason,
    estimatedSavingMinutes: typeof d.savingMinutes === 'number' ? d.savingMinutes : 30,
    confidence: 'high' as const,
    category: 'parallelism' as const,
  }))

  return { optimizedYaml, changes }
}
