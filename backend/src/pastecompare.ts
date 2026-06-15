import { AxiosInstance } from 'axios'
import { ClientConfig } from './types'

export interface ParsedRow {
  value: number
  label: string
}

export interface ParsedTable {
  title: string
  fieldLogicalName?: string   // extracted from "FieldLogicalName: xxx" metadata line
  docSourceType?: 'local' | 'global'  // extracted from "SourceType: EntityInlineOptionSet/StandaloneOptionSet"
  rows: ParsedRow[]
}

export interface PasteValueResult {
  value: number
  pastedLabel: string
  devLabel: string | null
  match: boolean
}

export type MatchMethod = 'displayName' | 'logicalName' | 'fuzzy' | 'valueOverlap'

export interface PasteCompareResult {
  tableTitle: string
  matchedConfigName: string | null
  matchMethod: MatchMethod | null
  matchedType: 'local' | 'global' | null
  status: 'match' | 'mismatch' | 'unmatched'
  values: PasteValueResult[]
  devOnly: Array<{ value: number; label: string }>
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function detectColumns(rows: string[][]): { valueCol: number; labelCol: number } | null {
  const sample = rows.slice(0, 10).filter(r => r.length >= 2)
  if (sample.length === 0) return null
  const isAllInt = (col: number) => sample.every(r => /^-?\d+$/.test((r[col] ?? '').trim()))
  if (isAllInt(0)) return { valueCol: 0, labelCol: 1 }
  if (isAllInt(1)) return { valueCol: 1, labelCol: 0 }
  return null
}

function extractRows(rawRows: string[][]): ParsedRow[] {
  const start = rawRows.length > 0 && isNaN(parseInt(rawRows[0][0], 10)) ? 1 : 0
  const data = rawRows.slice(start)
  const cols = detectColumns(data) ?? { valueCol: 0, labelCol: 1 }
  const rows: ParsedRow[] = []
  for (const cells of data) {
    const v = parseInt((cells[cols.valueCol] ?? '').trim(), 10)
    const label = (cells[cols.labelCol] ?? '').trim()
    if (!isNaN(v) && label) rows.push({ value: v, label })
  }
  return rows
}

// Known document metadata keys that are never useful as an option set title
const META_KEYS = /^(sourcetype|entity|entitylogicalname|fieldlogicalname|optionvalue|englishlabel):/i

// Analyse the preamble (all non-tabbed lines before the first data row) to extract:
//   • The best title — prefer lines that look like "logicalName (Display Name)" over generic metadata
//   • The FieldLogicalName if explicitly present
function analyzePreamble(lines: string[]): { title: string; fieldLogicalName?: string; docSourceType?: 'local' | 'global' } {
  let fieldLogicalName: string | undefined
  let docSourceType: 'local' | 'global' | undefined
  const candidates: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Capture FieldLogicalName and skip as a title candidate
    const flnMatch = line.match(/^fieldlogicalname:\s*(.+)$/i)
    if (flnMatch) { fieldLogicalName = flnMatch[1].trim(); continue }

    // Capture SourceType and skip as a title candidate
    const stMatch = line.match(/^sourcetype:\s*(.+)$/i)
    if (stMatch) {
      const st = stMatch[1].trim().toLowerCase()
      if (st === 'standaloneoptionset') docSourceType = 'global'
      else if (st === 'entityinlineoptionset') docSourceType = 'local'
      continue
    }

    // Skip other known metadata keys
    if (META_KEYS.test(line)) continue

    candidates.push(line)
  }

  const withParens = candidates.find(c => /\(.*\)/.test(c))
  const title = withParens ?? candidates[0] ?? ''

  return { title, fieldLogicalName, docSourceType }
}

// Main parser.
// Strategy: collect preamble lines (no tabs) until the first data row, then analyse.
// Blank lines inside the preamble are kept (they don't reset the title — this is the
// key fix: the blank between "optionSetName (Display)" and "SourceType: ..." no longer
// flushes the collected title).
// Blank lines after data rows: peek ahead — if next non-blank is a data row → within-table;
// if it's a non-tabbed line → table separator.
export function parsePastedContent(raw: string): ParsedTable[] {
  const lines = raw.split('\n').map(l => l.replace(/\r$/, '').trimEnd())
  const tables: ParsedTable[] = []

  let preamble: string[] = []  // non-tabbed lines accumulated before any data row
  let rawRows: string[][] = []

  function flush() {
    if (rawRows.length === 0) { preamble = []; return }
    const { title, fieldLogicalName, docSourceType } = analyzePreamble(preamble)
    const rows = extractRows(rawRows)
    if (rows.length > 0) tables.push({ title, fieldLogicalName, docSourceType, rows })
    preamble = []
    rawRows = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      if (rawRows.length === 0) {
        // Still in preamble — blank lines here are just spacing, keep collecting
        preamble.push(line)
        i++
        continue
      }

      // We have data rows — peek ahead
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++

      if (j >= lines.length || lines[j].includes('\t')) {
        // Trailing blanks or next is data → within-table blank
        i = j === lines.length ? j : i + 1
      } else {
        // Next is a non-tabbed line → table separator
        flush()
        i++
      }
      continue
    }

    if (!line.includes('\t')) {
      if (rawRows.length > 0) {
        // Non-tabbed line after data has started → new table begins → flush
        flush()
      }
      preamble.push(line)
      i++
      continue
    }

    // Tabbed line = data row
    rawRows.push(line.split('\t').map(c => c.trim()))
    i++
  }

  flush()
  return tables
}

// ─── Matching ────────────────────────────────────────────────────────────────

function prefer(matches: ClientConfig['optionSets']): ClientConfig['optionSets'][number] {
  return matches.find(m => m.type === 'global') ?? matches[0]
}

function findConfigMatch(
  title: string,
  fieldLogicalName: string | undefined,
  config: ClientConfig,
  pastedValues?: number[]
): { entry: ClientConfig['optionSets'][number]; method: MatchMethod } | null {
  const needle = title.trim().toLowerCase()

  // 1. FieldLogicalName from document metadata — highest confidence
  if (fieldLogicalName) {
    const fln = fieldLogicalName.toLowerCase()
    const byFln = config.optionSets.filter(os =>
      os.attribute?.toLowerCase() === fln ||
      os.name?.toLowerCase() === fln
    )
    if (byFln.length > 0) return { entry: prefer(byFln), method: 'logicalName' }
  }

  if (needle) {
    // 2. Exact display name
    const exact = config.optionSets.filter(os => os.displayName.trim().toLowerCase() === needle)
    if (exact.length > 0) return { entry: prefer(exact), method: 'displayName' }

    // 3. Extract logical name from "logicalName (Display Name)" pattern in title
    const nameParenMatch = needle.match(/^([a-z][a-z0-9_]*)\s*\(/i)
    if (nameParenMatch) {
      const extractedName = nameParenMatch[1].toLowerCase()
      const byExtracted = config.optionSets.filter(os =>
        os.attribute?.toLowerCase() === extractedName ||
        os.name?.toLowerCase() === extractedName
      )
      if (byExtracted.length > 0) return { entry: prefer(byExtracted), method: 'logicalName' }
    }

    // 4. FieldLogicalName prefix in title ("FieldLogicalName: leadsourcecode")
    if (needle.startsWith('fieldlogicalname:')) {
      const logicalName = needle.replace(/^fieldlogicalname:\s*/, '').trim()
      const byLogical = config.optionSets.filter(os =>
        os.attribute?.toLowerCase() === logicalName ||
        os.name?.toLowerCase() === logicalName
      )
      if (byLogical.length > 0) return { entry: prefer(byLogical), method: 'logicalName' }
    }

    // 5. Fuzzy display name (min 4 chars)
    if (needle.length >= 4) {
      const fuzzy = config.optionSets.filter(os => {
        const hay = os.displayName.trim().toLowerCase()
        return hay.includes(needle) || needle.includes(hay)
      })
      if (fuzzy.length > 0) return { entry: prefer(fuzzy), method: 'fuzzy' }
    }
  }

  // 6. Value-overlap fallback using config's stored values array
  if (pastedValues && pastedValues.length > 0) {
    const pasted = new Set(pastedValues)
    let bestEntry: ClientConfig['optionSets'][number] | null = null
    let bestScore = 0

    for (const os of config.optionSets) {
      if (!os.values || os.values.length === 0) continue
      const configVals = new Set(os.values.map(v => v.value))
      const overlap = pastedValues.filter(v => configVals.has(v)).length
      if (overlap === 0) continue
      const union = new Set([...pasted, ...configVals]).size
      const score = overlap / union
      if (score > bestScore) { bestScore = score; bestEntry = os }
    }

    if (bestEntry) {
      const configVals = new Set(bestEntry.values.map(v => v.value))
      const allPastedInConfig = pastedValues.every(v => configVals.has(v))
      if (bestScore > 0.3 || allPastedInConfig) {
        return { entry: bestEntry, method: 'valueOverlap' }
      }
    }
  }

  return null
}

// ─── Comparison ──────────────────────────────────────────────────────────────

async function fetchDevValues(
  matched: ClientConfig['optionSets'][number],
  devClient: AxiosInstance
): Promise<Map<number, string> | null> {
  try {
    if (matched.type === 'local') {
      const base = `/EntityDefinitions(LogicalName='${matched.entity}')/Attributes(LogicalName='${matched.attribute}')`
      const types = [
        'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
        'Microsoft.Dynamics.CRM.StatusAttributeMetadata',
        'Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata',
      ]
      for (const type of types) {
        try {
          const resp = await devClient.get(`${base}/${type}?$expand=OptionSet`)
          const options = resp.data.OptionSet?.Options ?? null
          if (options) {
            const map = new Map<number, string>()
            for (const opt of options) {
              const label =
                opt.Label.LocalizedLabels.find((l: any) => l.LanguageCode === 1033)?.Label ??
                opt.Label.LocalizedLabels[0]?.Label ?? ''
              map.set(opt.Value, label)
            }
            return map
          }
        } catch (e: any) {
          if (e?.response?.status !== 404) throw e
        }
      }
      return new Map()
    } else {
      const resp = await devClient.get(`/GlobalOptionSetDefinitions(Name='${matched.name}')`)
      const map = new Map<number, string>()
      for (const opt of resp.data.Options ?? []) {
        const label =
          opt.Label.LocalizedLabels.find((l: any) => l.LanguageCode === 1033)?.Label ??
          opt.Label.LocalizedLabels[0]?.Label ?? ''
        map.set(opt.Value, label)
      }
      return map
    }
  } catch {
    return null
  }
}

export async function comparePastedWithDev(
  tables: ParsedTable[],
  devClient: AxiosInstance,
  config: ClientConfig
): Promise<PasteCompareResult[]> {
  // Pass 1: match every table to a config entry, then deduplicate.
  // When the document has both a local and global copy of the same option set,
  // keep the global one — its SourceType in the doc is 'global' (StandaloneOptionSet).
  const unmatched: ParsedTable[] = []
  const matched = new Map<string, { table: ParsedTable; entry: ClientConfig['optionSets'][number]; method: MatchMethod }>()

  for (const table of tables) {
    const m = findConfigMatch(table.title, table.fieldLogicalName, config, table.rows.map(r => r.value))
    if (!m) { unmatched.push(table); continue }

    const key = m.entry.displayName
    const existing = matched.get(key)
    // Replace existing if this table is explicitly marked global in the document
    if (!existing || table.docSourceType === 'global') {
      matched.set(key, { table, entry: m.entry, method: m.method })
    }
  }

  // Pass 2: fetch dev values and build results (preserve insertion order via Map)
  const results: PasteCompareResult[] = []

  // Unmatched first (in original order)
  for (const table of unmatched) {
    results.push({
      tableTitle: table.title || '(untitled)',
      matchedConfigName: null,
      matchMethod: null,
      matchedType: null,
      status: 'unmatched',
      values: table.rows.map(r => ({ value: r.value, pastedLabel: r.label, devLabel: null, match: false })),
      devOnly: [],
    })
  }

  for (const { table, entry: configEntry, method: matchMethod } of matched.values()) {
    const devValues = await fetchDevValues(configEntry, devClient)
    const matchedType = table.docSourceType ?? configEntry.type

    if (!devValues) {
      results.push({
        tableTitle: table.title,
        matchedConfigName: configEntry.displayName,
        matchMethod,
        matchedType,
        status: 'unmatched',
        values: table.rows.map(r => ({ value: r.value, pastedLabel: r.label, devLabel: null, match: false })),
        devOnly: [],
      })
      continue
    }

    const pastedSet = new Set(table.rows.map(r => r.value))
    const values: PasteValueResult[] = table.rows.map(r => ({
      value: r.value,
      pastedLabel: r.label,
      devLabel: devValues.get(r.value) ?? null,
      match: devValues.get(r.value) === r.label,
    }))
    const devOnly = Array.from(devValues.entries())
      .filter(([v]) => !pastedSet.has(v))
      .map(([value, label]) => ({ value, label }))

    results.push({
      tableTitle: configEntry.displayName,
      matchedConfigName: configEntry.displayName,
      matchMethod,
      matchedType,
      status: values.every(v => v.match) && devOnly.length === 0 ? 'match' : 'mismatch',
      values,
      devOnly,
    })
  }

  return results
}
