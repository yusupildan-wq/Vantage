import axios, { AxiosInstance } from 'axios'
import { createMsalClient } from './auth'
import {
  ComparisonCategory,
  ComparisonItem,
  ComparisonReport,
  ComparisonSection,
  DiffStatus,
} from './types'

// ── Auth ──────────────────────────────────────────────────────────────────

async function getToken(environmentUrl: string): Promise<string> {
  const base = environmentUrl.endsWith('/') ? environmentUrl : `${environmentUrl}/`
  const msalClient = createMsalClient()
  const result = await msalClient.acquireTokenByClientCredential({ scopes: [`${base}.default`] })
  if (!result) throw new Error('Failed to acquire access token')
  return result.accessToken
}

function makeClient(baseUrl: string, token: string): AxiosInstance {
  return axios.create({
    baseURL: `${baseUrl}/api/data/v9.2`,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────

function diffMaps<T>(
  sourceMap: Map<string, T>,
  targetMap: Map<string, T>,
  getLabel: (key: string, val: T) => { sourceValue?: string; targetValue?: string } | null
): ComparisonItem[] {
  const allKeys = new Set([...sourceMap.keys(), ...targetMap.keys()])
  const items: ComparisonItem[] = []

  for (const key of allKeys) {
    const inSource = sourceMap.has(key)
    const inTarget = targetMap.has(key)

    if (!inSource) {
      items.push({ name: key, status: 'only_target', targetValue: String(targetMap.get(key) ?? '') })
      continue
    }
    if (!inTarget) {
      items.push({ name: key, status: 'only_source', sourceValue: String(sourceMap.get(key) ?? '') })
      continue
    }

    const labels = getLabel(key, sourceMap.get(key)!)
    const sv = String(sourceMap.get(key) ?? '')
    const tv = String(targetMap.get(key) ?? '')
    const status: DiffStatus = sv === tv ? 'match' : 'different'

    items.push({
      name: key,
      status,
      sourceValue: labels?.sourceValue ?? sv,
      targetValue: labels?.targetValue ?? tv,
    })
  }

  return items.sort((a, b) => {
    const order: Record<DiffStatus, number> = { different: 0, only_source: 1, only_target: 2, match: 3 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })
}

// ── Compare: Solutions ────────────────────────────────────────────────────

async function compareSolutions(
  clientA: AxiosInstance,
  clientB: AxiosInstance
): Promise<ComparisonSection> {
  const fetch = (client: AxiosInstance) =>
    client.get('/solutions', {
      params: {
        $filter: 'ismanaged eq true and isvisible eq true',
        $select: 'uniquename,friendlyname,version',
        $top: 500,
      },
    })

  const [respA, respB] = await Promise.all([fetch(clientA), fetch(clientB)])

  type Sol = { uniquename: string; friendlyname: string; version: string }
  const toMap = (arr: Sol[]) => new Map(arr.map(s => [s.uniquename, s]))

  const mapA = toMap(respA.data.value)
  const mapB = toMap(respB.data.value)
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])

  const items: ComparisonItem[] = []

  for (const key of allKeys) {
    const a = mapA.get(key)
    const b = mapB.get(key)
    const name = a?.friendlyname ?? b?.friendlyname ?? key

    if (!a) {
      items.push({ name, status: 'only_target', targetValue: `v${b!.version}` })
    } else if (!b) {
      items.push({ name, status: 'only_source', sourceValue: `v${a.version}` })
    } else {
      items.push({
        name,
        status: a.version === b.version ? 'match' : 'different',
        sourceValue: `v${a.version}`,
        targetValue: `v${b.version}`,
      })
    }
  }

  items.sort((a, b) => {
    const order: Record<DiffStatus, number> = { different: 0, only_source: 1, only_target: 2, match: 3 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })

  return { category: 'Solutions', items }
}

// ── Compare: Environment Variables ───────────────────────────────────────

async function compareEnvVars(
  clientA: AxiosInstance,
  clientB: AxiosInstance
): Promise<ComparisonSection> {
  const fetchDefs = (client: AxiosInstance) =>
    client.get('/environmentvariabledefinitions', {
      params: { $select: 'environmentvariabledefinitionid,schemaname,displayname,defaultvalue', $top: 500 },
    })

  const fetchVals = (client: AxiosInstance) =>
    client.get('/environmentvariablevalues', {
      params: { $select: 'value,_environmentvariabledefinitionid_value', $top: 500 },
    })

  const [defsA, defsB, valsA, valsB] = await Promise.all([
    fetchDefs(clientA), fetchDefs(clientB), fetchVals(clientA), fetchVals(clientB),
  ])

  type Def = { environmentvariabledefinitionid: string; schemaname: string; displayname: string; defaultvalue?: string }
  type Val = { value: string; _environmentvariabledefinitionid_value: string }

  function resolveValue(
    defs: Def[],
    vals: Val[],
    schemaname: string
  ): string {
    const def = defs.find(d => d.schemaname === schemaname)
    if (!def) return ''
    const val = vals.find(v => v._environmentvariabledefinitionid_value === def.environmentvariabledefinitionid)
    if (val?.value) return val.value
    if (def.defaultvalue) return `(default) ${def.defaultvalue}`
    return '(no value)'
  }

  const allSchemas = new Set([
    ...(defsA.data.value as Def[]).map(d => d.schemaname),
    ...(defsB.data.value as Def[]).map(d => d.schemaname),
  ])

  const items: ComparisonItem[] = []

  for (const schema of allSchemas) {
    const defA = (defsA.data.value as Def[]).find(d => d.schemaname === schema)
    const defB = (defsB.data.value as Def[]).find(d => d.schemaname === schema)
    const name = defA?.displayname ?? defB?.displayname ?? schema
    const svRaw = resolveValue(defsA.data.value, valsA.data.value, schema)
    const tvRaw = resolveValue(defsB.data.value, valsB.data.value, schema)

    if (!defA) {
      items.push({ name, status: 'only_target', targetValue: tvRaw })
    } else if (!defB) {
      items.push({ name, status: 'only_source', sourceValue: svRaw })
    } else {
      items.push({
        name,
        status: svRaw === tvRaw ? 'match' : 'different',
        sourceValue: svRaw,
        targetValue: tvRaw,
      })
    }
  }

  items.sort((a, b) => {
    const order: Record<DiffStatus, number> = { different: 0, only_source: 1, only_target: 2, match: 3 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })

  return { category: 'Environment Variables', items }
}

// ── Compare: Connection References ───────────────────────────────────────

async function compareConnections(
  clientA: AxiosInstance,
  clientB: AxiosInstance
): Promise<ComparisonSection> {
  const fetch = (client: AxiosInstance) =>
    client.get('/connectionreferences', {
      params: {
        $select: 'connectionreferencedisplayname,connectionreferencelogicalname,connectionid,statecode',
        $top: 500,
      },
    })

  const [respA, respB] = await Promise.all([fetch(clientA), fetch(clientB)])

  type Ref = {
    connectionreferencedisplayname: string
    connectionreferencelogicalname: string
    connectionid: string | null
    statecode: number
  }

  const label = (r: Ref) =>
    r.connectionid
      ? r.statecode === 0 ? 'Connected' : 'Connected (inactive)'
      : 'No connection'

  const toMap = (arr: Ref[]) =>
    new Map(arr.map(r => [r.connectionreferencelogicalname, r]))

  const mapA = toMap(respA.data.value)
  const mapB = toMap(respB.data.value)
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])

  const items: ComparisonItem[] = []

  for (const key of allKeys) {
    const a = mapA.get(key)
    const b = mapB.get(key)
    const name = a?.connectionreferencedisplayname ?? b?.connectionreferencedisplayname ?? key
    const sv = a ? label(a) : undefined
    const tv = b ? label(b) : undefined

    if (!a) {
      items.push({ name, status: 'only_target', targetValue: tv })
    } else if (!b) {
      items.push({ name, status: 'only_source', sourceValue: sv })
    } else {
      items.push({ name, status: sv === tv ? 'match' : 'different', sourceValue: sv, targetValue: tv })
    }
  }

  items.sort((a, b) => {
    const order: Record<DiffStatus, number> = { different: 0, only_source: 1, only_target: 2, match: 3 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })

  return { category: 'Connection References', items }
}

// ── Compare: Cloud Flows ──────────────────────────────────────────────────

async function compareFlows(
  clientA: AxiosInstance,
  clientB: AxiosInstance
): Promise<ComparisonSection> {
  const fetch = (client: AxiosInstance) =>
    client.get('/workflows', {
      params: { $filter: 'category eq 5', $select: 'name,statecode', $top: 500 },
    })

  const [respA, respB] = await Promise.all([fetch(clientA), fetch(clientB)])

  type Flow = { name: string; statecode: number }
  const stateLabel = (f: Flow) => f.statecode === 1 ? 'Enabled' : 'Disabled'

  const toMap = (arr: Flow[]) => new Map(arr.map(f => [f.name, f]))
  const mapA = toMap(respA.data.value)
  const mapB = toMap(respB.data.value)
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])

  const items: ComparisonItem[] = []

  for (const key of allKeys) {
    const a = mapA.get(key)
    const b = mapB.get(key)

    if (!a) {
      items.push({ name: key, status: 'only_target', targetValue: stateLabel(b!) })
    } else if (!b) {
      items.push({ name: key, status: 'only_source', sourceValue: stateLabel(a) })
    } else {
      const sv = stateLabel(a)
      const tv = stateLabel(b)
      items.push({ name: key, status: sv === tv ? 'match' : 'different', sourceValue: sv, targetValue: tv })
    }
  }

  items.sort((a, b) => {
    const order: Record<DiffStatus, number> = { different: 0, only_source: 1, only_target: 2, match: 3 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })

  return { category: 'Cloud Flows', items }
}

// ── Main export ───────────────────────────────────────────────────────────

export async function runComparison(
  sourceUrl: string,
  targetUrl: string
): Promise<ComparisonReport> {
  const [tokenA, tokenB] = await Promise.all([getToken(sourceUrl), getToken(targetUrl)])
  const clientA = makeClient(sourceUrl, tokenA)
  const clientB = makeClient(targetUrl, tokenB)

  const [solutions, envVars, connections, flows] = await Promise.all([
    compareSolutions(clientA, clientB),
    compareEnvVars(clientA, clientB),
    compareConnections(clientA, clientB),
    compareFlows(clientA, clientB),
  ])

  const sections: ComparisonSection[] = [solutions, envVars, connections, flows]

  const allItems = sections.flatMap(s => s.items)
  return {
    sourceEnvironment: sourceUrl,
    targetEnvironment: targetUrl,
    timestamp: new Date().toISOString(),
    sections,
    totalMatches:     allItems.filter(i => i.status === 'match').length,
    totalDifferences: allItems.filter(i => i.status === 'different').length,
    totalSourceOnly:  allItems.filter(i => i.status === 'only_source').length,
    totalTargetOnly:  allItems.filter(i => i.status === 'only_target').length,
  }
}
