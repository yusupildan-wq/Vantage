import axios, { AxiosInstance } from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { scanEnvironment } from './dataverse'
import { checkOptionSets } from './optionsets'
import { ClientConfig, ReadinessCheck, ReadinessReport } from './types'
import { createMsalClient } from './auth'
import { getClientConfigDir } from './runtimePaths'

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
      'Content-Type': 'application/json',
    },
  })
}

// ── Config loader (same logic as routes/optionsets.ts) ────────────────────

const CONFIG_DIR = getClientConfigDir()

function loadClientConfig(environmentUrl: string): ClientConfig | null {
  if (!fs.existsSync(CONFIG_DIR)) return null
  const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'))
  const normalised = environmentUrl.replace(/\/$/, '').toLowerCase()
  for (const file of files) {
    try {
      const config: ClientConfig = JSON.parse(
        fs.readFileSync(path.join(CONFIG_DIR, file), 'utf-8')
      )
      if (config.environmentUrl.replace(/\/$/, '').toLowerCase() === normalised) return config
    } catch { /* skip malformed configs */ }
  }
  return null
}

// ── Check 1: Active Layer ─────────────────────────────────────────────────

async function runActiveLayerCheck(environmentUrl: string): Promise<ReadinessCheck[]> {
  try {
    const results = await scanEnvironment(environmentUrl)
    const active    = results.filter(r => r.status === 'Active Layer')
    const unmanaged = results.filter(r => r.status === 'Unmanaged')

    const checks: ReadinessCheck[] = [
      {
        name: 'Active Layer Components',
        category: 'Active Layer',
        status: active.length > 0 ? 'fail' : 'pass',
        message: active.length > 0
          ? `${active.length} component(s) detected in the active layer`
          : 'No active layer components detected',
        details:     active.slice(0, 15).map(r => `${r.componentType}: ${r.componentName}`),
        remediation: active.length > 0
          ? 'Remove or publish active layer customizations before deploying.'
          : undefined,
      },
      {
        name: 'Unmanaged Customizations',
        category: 'Active Layer',
        status: unmanaged.length > 0 ? 'warn' : 'pass',
        message: unmanaged.length > 0
          ? `${unmanaged.length} unmanaged customization(s) detected`
          : 'No unmanaged customizations detected',
        details:     unmanaged.slice(0, 15).map(r => `${r.componentType}: ${r.componentName}`),
        remediation: unmanaged.length > 0
          ? 'Review unmanaged customizations and confirm they are expected before deploying.'
          : undefined,
      },
    ]

    return checks
  } catch (err) {
    return [{
      name: 'Active Layer Scan',
      category: 'Active Layer',
      status: 'fail',
      message: 'Failed to run active layer scan',
      details: [err instanceof Error ? err.message : 'Unknown error'],
    }]
  }
}

// ── Check 2: Cloud Flows ──────────────────────────────────────────────────

async function runFlowCheck(client: AxiosInstance): Promise<ReadinessCheck[]> {
  try {
    const resp = await client.get('/workflows', {
      params: {
        $filter: 'category eq 5',
        $select: 'name,statecode',
        $top: 500,
      },
    })

    const flows: Array<{ name: string; statecode: number }> = resp.data.value

    if (flows.length === 0) {
      return [{
        name: 'Cloud Flows',
        category: 'Flows',
        status: 'pass',
        message: 'No cloud flows found in this environment',
      }]
    }

    const disabled = flows.filter(f => f.statecode === 0)

    return [{
      name: 'Cloud Flows',
      category: 'Flows',
      status: disabled.length > 0 ? 'warn' : 'pass',
      message: disabled.length > 0
        ? `${disabled.length} of ${flows.length} cloud flow(s) are disabled`
        : `All ${flows.length} cloud flow(s) are enabled`,
      details:     disabled.slice(0, 15).map(f => f.name),
      remediation: disabled.length > 0
        ? 'Review and enable all flows required for Greymatter before deploying.'
        : undefined,
    }]
  } catch (err) {
    return [{
      name: 'Cloud Flows',
      category: 'Flows',
      status: 'warn',
      message: 'Could not retrieve flow status',
      details: [err instanceof Error ? err.message : 'Unknown error'],
    }]
  }
}

// ── Check 3: Solutions ────────────────────────────────────────────────────

async function runSolutionCheck(client: AxiosInstance): Promise<ReadinessCheck[]> {
  try {
    const resp = await client.get('/solutions', {
      params: {
        $filter: 'ismanaged eq true and isvisible eq true',
        $select: 'uniquename,friendlyname,version',
        $top: 500,
      },
    })

    const solutions: Array<{ uniquename: string; friendlyname: string; version: string }> =
      resp.data.value

    const greymatter = solutions.filter(s =>
      s.uniquename.toLowerCase().includes('grey') ||
      s.friendlyname.toLowerCase().includes('grey')
    )

    if (solutions.length === 0) {
      return [{
        name: 'Managed Solutions',
        category: 'Solutions',
        status: 'warn',
        message: 'No managed solutions found in this environment',
        remediation: 'Ensure the required Greymatter managed solutions are installed.',
      }]
    }

    if (greymatter.length === 0) {
      return [{
        name: 'Greymatter Solutions',
        category: 'Solutions',
        status: 'warn',
        message: `${solutions.length} managed solution(s) installed, but no Greymatter solutions detected`,
        details: solutions.slice(0, 10).map(s => `${s.friendlyname} (v${s.version})`),
        remediation: 'Verify that the required Greymatter solutions are installed.',
      }]
    }

    return [{
      name: 'Greymatter Solutions',
      category: 'Solutions',
      status: 'pass',
      message: `${greymatter.length} Greymatter solution(s) installed`,
      details: greymatter.map(s => `${s.friendlyname} v${s.version}`),
    }]
  } catch (err) {
    return [{
      name: 'Solution Validation',
      category: 'Solutions',
      status: 'fail',
      message: 'Failed to retrieve solution list',
      details: [err instanceof Error ? err.message : 'Unknown error'],
    }]
  }
}

// ── Check 4: Environment Variables ────────────────────────────────────────

async function runEnvVarCheck(client: AxiosInstance): Promise<ReadinessCheck[]> {
  try {
    // Two separate queries — $expand on environmentvariablevalues is not supported by all envs
    const [defsResp, valuesResp] = await Promise.all([
      client.get('/environmentvariabledefinitions', {
        params: {
          $select: 'environmentvariabledefinitionid,schemaname,displayname,defaultvalue',
          $top: 500,
        },
      }),
      client.get('/environmentvariablevalues', {
        params: {
          $select: 'value,_environmentvariabledefinitionid_value',
          $top: 500,
        },
      }),
    ])

    const defs: Array<{
      environmentvariabledefinitionid: string
      schemaname: string
      displayname: string
      defaultvalue?: string
    }> = defsResp.data.value

    if (defs.length === 0) {
      return [{
        name: 'Environment Variables',
        category: 'Environment Variables',
        status: 'pass',
        message: 'No environment variable definitions found',
      }]
    }

    // Build definitionId → value map
    const valueMap = new Map<string, string>()
    for (const v of valuesResp.data.value as Array<{ value: string; _environmentvariabledefinitionid_value: string }>) {
      if (v._environmentvariabledefinitionid_value) {
        valueMap.set(v._environmentvariabledefinitionid_value, v.value ?? '')
      }
    }

    const missing: string[] = []

    for (const def of defs) {
      const currentValue = valueMap.get(def.environmentvariabledefinitionid)
      const hasValue     = currentValue !== undefined && currentValue !== ''
      const hasDefault   = (def.defaultvalue ?? '') !== ''
      if (!hasValue && !hasDefault) {
        missing.push(def.displayname || def.schemaname)
      }
    }

    return [{
      name: 'Environment Variable Values',
      category: 'Environment Variables',
      status: missing.length > 0 ? 'fail' : 'pass',
      message: missing.length > 0
        ? `${missing.length} environment variable(s) have no value and no default`
        : `All ${defs.length} environment variable(s) have values or defaults`,
      details:     missing,
      remediation: missing.length > 0
        ? 'Set values for all required environment variables before deploying.'
        : undefined,
    }]
  } catch (err) {
    return [{
      name: 'Environment Variables',
      category: 'Environment Variables',
      status: 'fail',
      message: 'Failed to retrieve environment variables',
      details: [err instanceof Error ? err.message : 'Unknown error'],
    }]
  }
}

// ── Check 5: Connection References ────────────────────────────────────────

async function runConnectionRefCheck(client: AxiosInstance): Promise<ReadinessCheck[]> {
  try {
    const resp = await client.get('/connectionreferences', {
      params: {
        $select: 'connectionreferencedisplayname,connectionreferencelogicalname,connectionid,statecode',
        $top: 500,
      },
    })

    const refs: Array<{
      connectionreferencedisplayname: string
      connectionreferencelogicalname: string
      connectionid: string | null
      statecode: number
    }> = resp.data.value

    if (refs.length === 0) {
      return [{
        name: 'Connection References',
        category: 'Connection References',
        status: 'pass',
        message: 'No connection references found in this environment',
      }]
    }

    const broken   = refs.filter(r => !r.connectionid)
    const inactive = refs.filter(r => r.connectionid && r.statecode !== 0)
    const checks: ReadinessCheck[] = []

    if (broken.length > 0) {
      checks.push({
        name: 'Missing Connections',
        category: 'Connection References',
        status: 'fail',
        message: `${broken.length} connection reference(s) have no linked connection`,
        details: broken.map(r => r.connectionreferencedisplayname || r.connectionreferencelogicalname),
        remediation: 'Link all connection references to valid connections before deploying.',
      })
    }

    if (inactive.length > 0) {
      checks.push({
        name: 'Inactive Connections',
        category: 'Connection References',
        status: 'warn',
        message: `${inactive.length} connection reference(s) are inactive`,
        details: inactive.map(r => r.connectionreferencedisplayname || r.connectionreferencelogicalname),
        remediation: 'Activate all required connection references before deploying.',
      })
    }

    if (broken.length === 0 && inactive.length === 0) {
      checks.push({
        name: 'Connection References',
        category: 'Connection References',
        status: 'pass',
        message: `All ${refs.length} connection reference(s) are linked and active`,
      })
    }

    return checks
  } catch (err) {
    return [{
      name: 'Connection References',
      category: 'Connection References',
      status: 'fail',
      message: 'Failed to retrieve connection references',
      details: [err instanceof Error ? err.message : 'Unknown error'],
    }]
  }
}

// ── Check 6: Option Sets ──────────────────────────────────────────────────

async function runOptionSetCheck(
  client: AxiosInstance,
  environmentUrl: string
): Promise<ReadinessCheck[]> {
  const config = loadClientConfig(environmentUrl)

  if (!config) {
    return [{
      name: 'Option Set Values',
      category: 'Option Sets',
      status: 'skip',
      message: 'No client configuration found — option set validation skipped',
      remediation: 'Add a client config file to config/clients/ to enable option set validation.',
    }]
  }

  try {
    const results    = await checkOptionSets(client, config)
    const mismatches = results.filter(r => r.status === 'mismatch')
    const errors     = results.filter(r => r.status === 'error')
    const checks: ReadinessCheck[] = []

    if (errors.length > 0) {
      checks.push({
        name: 'Option Set Errors',
        category: 'Option Sets',
        status: 'fail',
        message: `${errors.length} option set(s) could not be validated`,
        details: errors.map(r => `${r.displayName}: ${r.error}`),
      })
    }

    if (mismatches.length > 0) {
      checks.push({
        name: 'Option Set Values',
        category: 'Option Sets',
        status: 'fail',
        message: `${mismatches.length} option set(s) have mismatched values`,
        details: mismatches.map(r => r.displayName),
        remediation: 'Use the Option Set Guard to restore mismatched values before deploying.',
      })
    }

    if (errors.length === 0 && mismatches.length === 0) {
      checks.push({
        name: 'Option Set Values',
        category: 'Option Sets',
        status: 'pass',
        message: `All ${results.length} option set(s) match the expected configuration`,
      })
    }

    return checks
  } catch (err) {
    return [{
      name: 'Option Set Validation',
      category: 'Option Sets',
      status: 'fail',
      message: 'Failed to validate option sets',
      details: [err instanceof Error ? err.message : 'Unknown error'],
    }]
  }
}

// ── Main export ───────────────────────────────────────────────────────────

export async function runReadinessCheck(environmentUrl: string): Promise<ReadinessReport> {
  const baseUrl = environmentUrl.replace(/\/$/, '')
  const token   = await getToken(baseUrl)
  const client  = makeClient(baseUrl, token)

  // Active layer runs its own auth internally; the rest share the client above
  const [
    activeLayerChecks,
    flowChecks,
    solutionChecks,
    envVarChecks,
    connectionRefChecks,
    optionSetChecks,
  ] = await Promise.all([
    runActiveLayerCheck(baseUrl),
    runFlowCheck(client),
    runSolutionCheck(client),
    runEnvVarCheck(client),
    runConnectionRefCheck(client),
    runOptionSetCheck(client, baseUrl),
  ])

  const allChecks = [
    ...activeLayerChecks,
    ...flowChecks,
    ...solutionChecks,
    ...envVarChecks,
    ...connectionRefChecks,
    ...optionSetChecks,
  ]

  const failures = allChecks.filter(c => c.status === 'fail').length
  const warnings = allChecks.filter(c => c.status === 'warn').length
  const passed   = allChecks.filter(c => c.status === 'pass').length
  const skipped  = allChecks.filter(c => c.status === 'skip').length

  return {
    environment: baseUrl,
    timestamp: new Date().toISOString(),
    overallStatus: failures > 0 ? 'NOT READY' : warnings > 0 ? 'WARNINGS' : 'READY',
    passed,
    warnings,
    failures,
    skipped,
    checks: allChecks,
  }
}
