import axios from 'axios'
import { AxiosInstance } from 'axios'
import { ConfidentialClientApplication } from '@azure/msal-node'

export interface LoopTableRow {
  value: number
  label: string
}

export interface LoopTable {
  title: string
  rows: LoopTableRow[]
}

export interface LoopValueResult {
  value: number
  loopLabel: string
  devLabel: string | null
  match: boolean
}

export interface LoopCompareResult {
  tableTitle: string
  status: 'match' | 'mismatch' | 'unmatched'
  values: LoopValueResult[]
  devOnly: Array<{ value: number; label: string }>
}

// Decode the base64 payload in a Loop URL to extract the SharePoint URL
export function decodeLoopUrl(loopUrl: string): string | null {
  try {
    const match = loopUrl.match(/\/p\/([A-Za-z0-9+/=_-]+)/)
    if (!match) return null
    let token = match[1]
    const rem = token.length % 4
    if (rem) token += '='.repeat(4 - rem)
    // Try URL-safe base64 (replace - and _ with + and /)
    const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    const obj = JSON.parse(decoded)
    return obj?.w?.u ?? obj?.u ?? null
  } catch {
    return null
  }
}

async function getGraphToken(): Promise<string> {
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    },
  })
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  })
  if (!result?.accessToken) throw new Error('Failed to acquire Graph API token')
  return result.accessToken
}

// Extract text from HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}

// Parse <table> elements from an HTML string into structured rows
function parseHtmlTables(html: string): Array<{ title: string; rows: string[][] }> {
  const results: Array<{ title: string; rows: string[][] }> = []

  // Collect headings with their positions for title matching
  const headings: Array<{ pos: number; text: string }> = []
  const headingRe = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
  let hm: RegExpExecArray | null
  while ((hm = headingRe.exec(html)) !== null) {
    headings.push({ pos: hm.index, text: stripHtml(hm[1]) })
  }

  // Also check for <p> or <strong> immediately before a table
  const strongRe = /<(?:p|strong|b)[^>]*>([\s\S]*?)<\/(?:p|strong|b)>/gi
  while ((hm = strongRe.exec(html)) !== null) {
    headings.push({ pos: hm.index, text: stripHtml(hm[1]) })
  }

  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tm: RegExpExecArray | null
  let tableIdx = 0

  while ((tm = tableRe.exec(html)) !== null) {
    const tablePos = tm.index
    const tableHtml = tm[1]

    // Find the nearest heading before this table
    let title = `Table ${++tableIdx}`
    const preceding = headings
      .filter(h => h.pos < tablePos && h.text.length > 0)
      .sort((a, b) => b.pos - a.pos)
    if (preceding.length > 0) title = preceding[0].text

    // Parse rows
    const rows: string[][] = []
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rm: RegExpExecArray | null
    while ((rm = rowRe.exec(tableHtml)) !== null) {
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      const cells: string[] = []
      let cm: RegExpExecArray | null
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push(stripHtml(cm[1]))
      }
      if (cells.length > 0) rows.push(cells)
    }

    if (rows.length > 1) results.push({ title, rows }) // need at least header + 1 data row
  }

  return results
}

// Convert raw table rows into typed LoopTable (value number + label string)
function extractOptionRows(rawRows: string[][]): LoopTableRow[] {
  const result: LoopTableRow[] = []
  // Skip header row(s) — first row is usually a header
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (row.length < 2) continue
    const value = parseInt(row[0], 10)
    const label = row[1]
    if (!isNaN(value) && label) result.push({ value, label })
  }
  return result
}

function graphAuthError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error(
      `GRAPH_PERMISSION_REQUIRED: The Azure app (${process.env.AZURE_CLIENT_ID}) does not have permission to read SharePoint/Loop pages. ` +
      `In Azure Portal → App Registrations → select this app → API permissions → Add a permission → Microsoft Graph → ` +
      `Application permissions → Sites.Read.All → Add → Grant admin consent for your tenant.`
    )
  }
  return new Error(`Graph API error (${status})`)
}

// Fetch the Loop page content via Graph API and return parsed tables
export async function fetchLoopTables(loopUrl: string): Promise<LoopTable[]> {
  const sharePointUrl = decodeLoopUrl(loopUrl)
  if (!sharePointUrl) throw new Error('Could not decode Loop document URL — make sure it starts with https://loop.cloud.microsoft/p/...')

  const token = await getGraphToken()
  const spUrl = new URL(sharePointUrl)
  const hostname = spUrl.hostname

  // Resolve the site
  const sitePath = spUrl.pathname === '/' || !spUrl.pathname ? '/' : spUrl.pathname
  let siteResp: any
  try {
    siteResp = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 401 || status === 403) throw graphAuthError(status)
    throw err
  }
  const siteId: string = siteResp.data.id

  // List site pages (SharePoint Site Pages library)
  const pagesResp = await axios.get(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/pages?$select=id,title,webUrl`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  // Try to match the page via the nav param or URL
  const navParam = spUrl.searchParams.get('nav')
  let pageId: string | null = null

  if (navParam) {
    try {
      const navDecoded = Buffer.from(navParam.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
      for (const page of pagesResp.data.value ?? []) {
        if (navDecoded.includes(page.id) || navDecoded.includes(encodeURIComponent(page.title))) {
          pageId = page.id
          break
        }
      }
    } catch {}
  }

  // Fallback: first page if only one exists, else error
  if (!pageId) {
    const pages: any[] = pagesResp.data.value ?? []
    if (pages.length === 1) {
      pageId = pages[0].id
    } else if (pages.length > 1) {
      throw new Error(
        `Found ${pages.length} pages in the SharePoint site. Could not determine which page the Loop URL points to. ` +
        `Pages: ${pages.map((p: any) => p.title).join(', ')}`
      )
    } else {
      throw new Error('No pages found in the SharePoint site.')
    }
  }

  // Fetch page content
  const pageResp = await axios.get(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/pages/${pageId}/microsoft.graph.sitePage?$expand=canvasLayout`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  // Collect all HTML from web parts in the canvas layout
  let html = ''
  const sections = pageResp.data?.canvasLayout?.horizontalSections ?? []
  for (const section of sections) {
    for (const column of section.columns ?? []) {
      for (const wp of column.webparts ?? []) {
        const inner =
          wp.data?.innerHTML ??
          wp.data?.htmlContent ??
          wp.innerHtml ??
          ''
        html += inner
      }
    }
  }

  if (!html) throw new Error('No HTML content found on the Loop page. The page may be empty or use an unsupported format.')

  // Parse tables
  const rawTables = parseHtmlTables(html)
  return rawTables.map(t => ({
    title: t.title,
    rows: extractOptionRows(t.rows),
  })).filter(t => t.rows.length > 0)
}

// Compare Loop tables against dev's live option set values, matched by displayName from config
export async function compareLoopWithDev(
  loopTables: LoopTable[],
  devClient: AxiosInstance,
  config: import('./types').ClientConfig
): Promise<LoopCompareResult[]> {
  const results: LoopCompareResult[] = []

  for (const table of loopTables) {
    // Match this table to an option set in the config by displayName (case-insensitive, trimmed)
    const matched = config.optionSets.find(
      os => os.displayName.trim().toLowerCase() === table.title.trim().toLowerCase()
    )

    if (!matched) {
      results.push({
        tableTitle: table.title,
        status: 'unmatched',
        values: table.rows.map(r => ({ value: r.value, loopLabel: r.label, devLabel: null, match: false })),
        devOnly: [],
      })
      continue
    }

    // Fetch live dev values for this option set
    let devValues: Map<number, string>
    try {
      if (matched.type === 'local') {
        const base = `/EntityDefinitions(LogicalName='${matched.entity}')/Attributes(LogicalName='${matched.attribute}')`
        const types = [
          'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
          'Microsoft.Dynamics.CRM.StatusAttributeMetadata',
          'Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata',
        ]
        devValues = new Map()
        for (const type of types) {
          try {
            const resp = await devClient.get(`${base}/${type}?$expand=OptionSet`)
            const options = resp.data.OptionSet?.Options ?? null
            if (options) {
              for (const opt of options) {
                const label =
                  opt.Label.LocalizedLabels.find((l: any) => l.LanguageCode === 1033)?.Label ??
                  opt.Label.LocalizedLabels[0]?.Label ?? ''
                devValues.set(opt.Value, label)
              }
              break
            }
          } catch (e: any) {
            if (e?.response?.status !== 404) throw e
          }
        }
      } else {
        const resp = await devClient.get(`/GlobalOptionSetDefinitions(Name='${matched.name}')`)
        devValues = new Map()
        for (const opt of resp.data.Options ?? []) {
          const label =
            opt.Label.LocalizedLabels.find((l: any) => l.LanguageCode === 1033)?.Label ??
            opt.Label.LocalizedLabels[0]?.Label ?? ''
          devValues.set(opt.Value, label)
        }
      }
    } catch {
      results.push({
        tableTitle: table.title,
        status: 'unmatched',
        values: table.rows.map(r => ({ value: r.value, loopLabel: r.label, devLabel: null, match: false })),
        devOnly: [],
      })
      continue
    }

    const loopValueSet = new Set(table.rows.map(r => r.value))
    const values: LoopValueResult[] = table.rows.map(r => ({
      value: r.value,
      loopLabel: r.label,
      devLabel: devValues.get(r.value) ?? null,
      match: devValues.get(r.value) === r.label,
    }))

    const devOnly = Array.from(devValues.entries())
      .filter(([v]) => !loopValueSet.has(v))
      .map(([value, label]) => ({ value, label }))

    results.push({
      tableTitle: table.title,
      status: values.every(v => v.match) && devOnly.length === 0 ? 'match' : 'mismatch',
      values,
      devOnly,
    })
  }

  return results
}
