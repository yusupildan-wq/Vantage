import { AxiosInstance } from 'axios'

export interface AffectedFlow {
  id: string
  name: string
  enabled: boolean
}

export interface ConnectionRefHealth {
  id: string
  logicalName: string
  displayName: string
  connectorType: string
  connectorId: string
  hasConnection: boolean
  status: 'healthy' | 'broken'
  ownerId: string
  isManaged: boolean
  affectedFlows: AffectedFlow[]
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
}

const CONNECTOR_NAMES: Record<string, string> = {
  shared_sharepointonline:         'SharePoint',
  shared_commondataserviceforapps: 'Dataverse',
  shared_office365:                'Outlook',
  shared_microsoftteams:           'Teams',
  shared_teams:                    'Teams',
  shared_office365users:           'Office 365 Users',
  shared_approvals:                'Approvals',
  shared_onedriveforbusiness:      'OneDrive',
  shared_azureblob:                'Azure Blob',
  shared_azurekeyvault:            'Key Vault',
  shared_sql:                      'SQL Server',
  shared_excelonlinebusiness:      'Excel Online',
  shared_flowmanagement:           'Flow Management',
  shared_powerplatformforadmins:   'Power Platform Admin',
  shared_dynamicscrmonline:        'Dynamics 365',
  shared_sendgrid:                 'SendGrid',
  shared_twilio:                   'Twilio',
  shared_slack:                    'Slack',
  shared_azurequeues:              'Azure Queues',
}

function connectorDisplayName(connectorId: string): string {
  if (!connectorId) return 'Unknown'
  const api = connectorId.split('/').pop() ?? connectorId
  return CONNECTOR_NAMES[api] ?? api.replace(/^shared_/, '').replace(/_/g, ' ')
}

function extractConnectionRefs(clientData: string): string[] {
  const seen = new Set<string>()
  const regex = /"connectionReferenceLogicalName"\s*:\s*"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(clientData)) !== null) seen.add(match[1])
  return [...seen]
}

export async function getEnvironmentId(client: AxiosInstance): Promise<string | null> {
  try {
    const resp = await client.get(`/organizations?$select=organizationid&$top=1`)
    return resp.data.value?.[0]?.organizationid ?? null
  } catch {
    return null
  }
}

export async function getConnectionRefHealth(client: AxiosInstance): Promise<ConnectionRefHealth[]> {
  const [refsResp, flowsResp] = await Promise.all([
    client.get(
      `/connectionreferences?$select=connectionreferenceid,connectionreferencelogicalname,connectorid,connectionid,statecode,_ownerid_value,ismanaged`
    ),
    client.get(
      `/workflows?$filter=category eq 5&$select=workflowid,name,statecode,clientdata&$top=500`
    ),
  ])

  const refs: any[] = refsResp.data.value ?? []
  const flows: any[] = flowsResp.data.value ?? []

  const refToFlows = new Map<string, AffectedFlow[]>()
  for (const flow of flows) {
    if (!flow.clientdata) continue
    let names: string[]
    try { names = extractConnectionRefs(flow.clientdata) } catch { continue }
    for (const name of names) {
      if (!refToFlows.has(name)) refToFlows.set(name, [])
      refToFlows.get(name)!.push({ id: flow.workflowid, name: flow.name, enabled: flow.statecode === 1 })
    }
  }

  const result: ConnectionRefHealth[] = refs.map(ref => {
    const logicalName: string = ref.connectionreferencelogicalname ?? ''
    const rawConnectorId: string = ref.connectorid ?? ''
    const hasConnection = !!ref.connectionid
    const affectedFlows = refToFlows.get(logicalName) ?? []
    const status: 'healthy' | 'broken' = hasConnection ? 'healthy' : 'broken'

    let riskLevel: 'critical' | 'high' | 'medium' | 'low'
    if (status === 'broken' && affectedFlows.length > 0) riskLevel = 'critical'
    else if (status === 'broken') riskLevel = 'medium'
    else if (affectedFlows.length >= 5) riskLevel = 'high'
    else if (affectedFlows.length >= 2) riskLevel = 'medium'
    else riskLevel = 'low'

    return {
      id: ref.connectionreferenceid,
      logicalName,
      displayName: logicalName,
      connectorType: connectorDisplayName(rawConnectorId),
      connectorId: rawConnectorId,
      hasConnection,
      status,
      ownerId: ref['_ownerid_value'] ?? '',
      isManaged: !!ref.ismanaged,
      affectedFlows,
      riskLevel,
    }
  })

  const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return result.sort((a, b) =>
    riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
    b.affectedFlows.length - a.affectedFlows.length
  )
}

export async function autoFixConnectionRef(
  client: AxiosInstance,
  connectionRefId: string
): Promise<{ success: boolean; message: string; donorName?: string }> {
  // Fetch all connection refs fresh to get current connectionid values
  const resp = await client.get(
    `/connectionreferences?$select=connectionreferenceid,connectionreferencelogicalname,connectorid,connectionid`
  )
  const allRefs: any[] = resp.data.value ?? []

  const target = allRefs.find(r => r.connectionreferenceid === connectionRefId)
  if (!target) return { success: false, message: 'Connection reference not found.' }
  if (target.connectionid) return { success: false, message: 'This connection reference is already healthy.' }

  const targetConnectorId = (target.connectorid ?? '').split('/').pop() ?? ''

  // Find a healthy ref using the same connector
  const donor = allRefs.find(r =>
    r.connectionreferenceid !== connectionRefId &&
    !!r.connectionid &&
    (r.connectorid ?? '').split('/').pop() === targetConnectorId
  )

  if (!donor) {
    return {
      success: false,
      message: `No healthy ${connectorDisplayName(target.connectorid ?? '')} connection found in this environment to copy from.`,
    }
  }

  try {
    await client.patch(
      `/connectionreferences(${connectionRefId})`,
      { connectionid: donor.connectionid },
      { headers: { 'If-Match': '*' } }
    )
    return {
      success: true,
      message: `Connection attached using ${donor.connectionreferencelogicalname} as the source.`,
      donorName: donor.connectionreferencelogicalname,
    }
  } catch (err: any) {
    const detail = err?.response?.data?.error?.message ?? err?.message ?? 'Patch failed'
    return { success: false, message: detail }
  }
}
