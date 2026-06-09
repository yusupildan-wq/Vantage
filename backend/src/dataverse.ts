import { ConfidentialClientApplication } from '@azure/msal-node'
import axios, { AxiosInstance } from 'axios'
import { ScanResult, ComponentStatus } from './types'

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
})

async function getToken(environmentUrl: string): Promise<string> {
  const baseUrl = environmentUrl.endsWith('/') ? environmentUrl : `${environmentUrl}/`
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: [`${baseUrl}.default`],
  })
  if (!result) throw new Error('Failed to acquire access token')
  return result.accessToken
}

function makeClient(baseUrl: string, token: string): AxiosInstance {
  return axios.create({
    baseURL: `${baseUrl}/api/data/v9.2`,
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
    },
  })
}

const WORKFLOW_CATEGORY: Record<number, string> = {
  0: 'Workflow',
  1: 'Dialog',
  2: 'Business Rule',
  3: 'Action',
  4: 'Business Process Flow',
  5: 'Flow',
}

export async function scanEnvironment(environmentUrl: string): Promise<ScanResult[]> {
  const baseUrl = environmentUrl.endsWith('/') ? environmentUrl.slice(0, -1) : environmentUrl
  const token = await getToken(baseUrl)
  const client = makeClient(baseUrl, token)

  const results: ScanResult[] = []
  let idx = 1

  // --- Workflows ---
  const wfResp = await client.get('/workflows?$select=name,category,ismanaged&$top=500')
  const allWorkflows: any[] = wfResp.data.value

  const managedWfNames = new Set(
    allWorkflows.filter((w: any) => w.ismanaged).map((w: any) => w.name as string)
  )

  for (const wf of allWorkflows) {
    if (wf.ismanaged) {
      results.push({
        id: String(idx++),
        componentName: wf.name,
        componentType: WORKFLOW_CATEGORY[wf.category] ?? 'Workflow',
        status: 'Base Layer',
        message: 'No active-layer customizations found.',
      })
    } else {
      const isActiveLayer = managedWfNames.has(wf.name)
      results.push({
        id: String(idx++),
        componentName: wf.name,
        componentType: WORKFLOW_CATEGORY[wf.category] ?? 'Workflow',
        status: isActiveLayer ? 'Active Layer' : 'Unmanaged',
        message: isActiveLayer
          ? 'Unmanaged customization exists on top of a managed workflow.'
          : 'Process is unmanaged and not part of any managed solution.',
      })
    }
  }

  // --- Custom Entities ---
  const entitiesResp = await client.get(
    '/EntityDefinitions?$select=LogicalName,IsManaged,IsCustomEntity'
  )

  for (const entity of entitiesResp.data.value) {
    if (!entity.IsCustomEntity) continue
    const status: ComponentStatus = entity.IsManaged ? 'Base Layer' : 'Unmanaged'
    results.push({
      id: String(idx++),
      componentName: entity.LogicalName,
      componentType: 'Entity',
      status,
      message: entity.IsManaged
        ? 'No active-layer customizations found.'
        : 'Custom entity is unmanaged and not part of any managed solution.',
    })
  }

  return results
}
