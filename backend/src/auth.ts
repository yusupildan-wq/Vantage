import { ConfidentialClientApplication } from '@azure/msal-node'
import axios, { AxiosInstance } from 'axios'

export function createMsalClient(): ConfidentialClientApplication {
  const clientId = process.env.AZURE_CLIENT_ID?.trim()
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim()
  const tenantId = process.env.AZURE_TENANT_ID?.trim()
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Vantage is not configured. Complete setup before connecting to Microsoft services.')
  }
  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  })
}

export function validateEnvironmentUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid environment URL')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Environment URL must use HTTPS')
  }
  if (!parsed.hostname.endsWith('.dynamics.com')) {
    throw new Error('Environment URL must be a valid Power Platform environment (*.dynamics.com)')
  }
}

export async function makeDataverseClient(
  environmentUrl: string,
  timeoutMs = 15000
): Promise<AxiosInstance> {
  validateEnvironmentUrl(environmentUrl)

  const baseUrl = environmentUrl.endsWith('/') ? environmentUrl : `${environmentUrl}/`
  const msalClient = createMsalClient()
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: [`${baseUrl}.default`],
  })
  if (!result) throw new Error('Failed to acquire access token')

  return axios.create({
    baseURL: `${environmentUrl.replace(/\/$/, '')}/api/data/v9.2`,
    timeout: timeoutMs,
    headers: {
      Authorization: `Bearer ${result.accessToken}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}
