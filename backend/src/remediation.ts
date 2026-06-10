import { ConfidentialClientApplication } from '@azure/msal-node'
import axios, { AxiosInstance } from 'axios'

// ── Auth (same pattern as comparison.ts) ──────────────────────────────────

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
})

async function getToken(environmentUrl: string): Promise<string> {
  const base = environmentUrl.endsWith('/') ? environmentUrl : `${environmentUrl}/`
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

// ── Types ──────────────────────────────────────────────────────────────────

export type FixType     = 'auto' | 'manual'
export type FixCategory = 'Cloud Flow' | 'Environment Variable' | 'Connection Reference'

export interface RemediationItem {
  id: string
  name: string
  category: FixCategory
  currentState: string
  proposedFix: string
  fixType: FixType
  deepLink?: string
}

export interface RemediationPlan {
  environmentUrl: string
  timestamp: string
  items: RemediationItem[]
  autoFixCount: number
  manualCount: number
}

// ── Scanners (GET only — zero writes) ─────────────────────────────────────

async function findDisabledFlows(client: AxiosInstance): Promise<RemediationItem[]> {
  const resp = await client.get('/workflows', {
    params: {
      $filter: 'category eq 5 and statecode eq 0',
      $select: 'workflowid,name',
      $top: 500,
    },
  })

  type Flow = { workflowid: string; name: string }
  return (resp.data.value as Flow[]).map(f => ({
    id: f.workflowid,
    name: f.name,
    category: 'Cloud Flow',
    currentState: 'Disabled',
    proposedFix: 'Enable flow',
    fixType: 'auto',
  }))
}

async function findEnvVarsWithDefaults(client: AxiosInstance): Promise<RemediationItem[]> {
  const [defsResp, valsResp] = await Promise.all([
    client.get('/environmentvariabledefinitions', {
      params: { $select: 'environmentvariabledefinitionid,schemaname,displayname,defaultvalue', $top: 500 },
    }),
    client.get('/environmentvariablevalues', {
      params: { $select: '_environmentvariabledefinitionid_value', $top: 500 },
    }),
  ])

  type Def = { environmentvariabledefinitionid: string; schemaname: string; displayname: string; defaultvalue?: string }
  type Val = { _environmentvariabledefinitionid_value: string }

  const defs: Def[] = defsResp.data.value
  const vals: Val[] = valsResp.data.value
  const setIds = new Set(vals.map(v => v._environmentvariabledefinitionid_value))

  return defs
    .filter(d => !setIds.has(d.environmentvariabledefinitionid) && d.defaultvalue)
    .map(d => ({
      id: d.environmentvariabledefinitionid,
      name: d.displayname || d.schemaname,
      category: 'Environment Variable',
      currentState: 'No value set',
      proposedFix: `Apply default value: "${d.defaultvalue}"`,
      fixType: 'auto',
    }))
}

async function findDisconnectedRefs(client: AxiosInstance): Promise<RemediationItem[]> {
  const resp = await client.get('/connectionreferences', {
    params: {
      $select: 'connectionreferencedisplayname,connectionreferencelogicalname,connectionid',
      $top: 500,
    },
  })

  type Ref = {
    connectionreferencedisplayname: string
    connectionreferencelogicalname: string
    connectionid: string | null
  }

  return (resp.data.value as Ref[])
    .filter(r => !r.connectionid)
    .map(r => ({
      id: r.connectionreferencelogicalname,
      name: r.connectionreferencedisplayname || r.connectionreferencelogicalname,
      category: 'Connection Reference',
      currentState: 'No connection assigned',
      proposedFix: 'Manually assign a connection in Power Apps maker portal',
      fixType: 'manual',
      deepLink: 'https://make.powerapps.com',
    }))
}

// ── Main export (read-only — builds plan, makes no changes) ───────────────

export async function buildRemediationPlan(environmentUrl: string): Promise<RemediationPlan> {
  const token = await getToken(environmentUrl)
  const client = makeClient(environmentUrl, token)

  const [flows, envVars, connections] = await Promise.all([
    findDisabledFlows(client),
    findEnvVarsWithDefaults(client),
    findDisconnectedRefs(client),
  ])

  const items: RemediationItem[] = [...flows, ...envVars, ...connections]

  return {
    environmentUrl,
    timestamp: new Date().toISOString(),
    items,
    autoFixCount: items.filter(i => i.fixType === 'auto').length,
    manualCount:  items.filter(i => i.fixType === 'manual').length,
  }
}
