import { AxiosInstance } from 'axios'
import { ClientConfig, OptionSetCheckResult, OptionSetValueStatus } from './types'

async function fetchLocalOptionSet(
  client: AxiosInstance,
  entity: string,
  attribute: string
): Promise<Map<number, string>> {
  const resp = await client.get(
    `/EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${attribute}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`
  )
  const options: Array<{
    Value: number
    Label: { LocalizedLabels: Array<{ Label: string; LanguageCode: number }> }
  }> = resp.data.OptionSet.Options

  const map = new Map<number, string>()
  for (const opt of options) {
    const label =
      opt.Label.LocalizedLabels.find(l => l.LanguageCode === 1033)?.Label ??
      opt.Label.LocalizedLabels[0]?.Label ??
      ''
    map.set(opt.Value, label)
  }
  return map
}

async function fetchGlobalOptionSet(
  client: AxiosInstance,
  name: string
): Promise<Map<number, string>> {
  const resp = await client.get(`/GlobalOptionSetDefinitions(Name='${name}')`)
  const options: Array<{
    Value: number
    Label: { LocalizedLabels: Array<{ Label: string; LanguageCode: number }> }
  }> = resp.data.Options

  const map = new Map<number, string>()
  for (const opt of options) {
    const label =
      opt.Label.LocalizedLabels.find(l => l.LanguageCode === 1033)?.Label ??
      opt.Label.LocalizedLabels[0]?.Label ??
      ''
    map.set(opt.Value, label)
  }
  return map
}

function makeLabel(label: string) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
        Label: label,
        LanguageCode: 1033,
      },
    ],
  }
}

async function upsertLocalOptionValue(
  client: AxiosInstance,
  entity: string,
  attribute: string,
  value: number,
  label: string,
  exists: boolean
): Promise<void> {
  const action = exists ? 'UpdateOptionValue' : 'InsertOptionValue'
  await client.post(`/${action}`, {
    EntityLogicalName: entity,
    AttributeLogicalName: attribute,
    Value: value,
    Label: makeLabel(label),
    ...(exists ? { MergeLabels: false } : {}),
  })
}

async function upsertGlobalOptionValue(
  client: AxiosInstance,
  name: string,
  value: number,
  label: string,
  exists: boolean
): Promise<void> {
  const action = exists ? 'UpdateOptionValue' : 'InsertOptionValue'
  await client.post(`/${action}`, {
    OptionSetName: name,
    Value: value,
    Label: makeLabel(label),
    ...(exists ? { MergeLabels: false } : {}),
  })
}

async function publishEntity(client: AxiosInstance, entity: string): Promise<void> {
  await client.post('/PublishXml', {
    ParameterXml: `<importexportxml><entities><entity>${entity}</entity></entities></importexportxml>`,
  })
}

async function publishGlobalOptionSet(client: AxiosInstance, name: string): Promise<void> {
  await client.post('/PublishXml', {
    ParameterXml: `<importexportxml><optionsets><optionset>${name}</optionset></optionsets></importexportxml>`,
  })
}

export async function checkOptionSets(
  client: AxiosInstance,
  config: ClientConfig
): Promise<OptionSetCheckResult[]> {
  const results: OptionSetCheckResult[] = []

  for (const optionSet of config.optionSets) {
    try {
      const currentValues =
        optionSet.type === 'local'
          ? await fetchLocalOptionSet(client, optionSet.entity!, optionSet.attribute!)
          : await fetchGlobalOptionSet(client, optionSet.name!)

      const values: OptionSetValueStatus[] = optionSet.values.map(v => ({
        value: v.value,
        expectedLabel: v.label,
        currentLabel: currentValues.get(v.value) ?? null,
        match: currentValues.get(v.value) === v.label,
      }))

      results.push({
        displayName: optionSet.displayName,
        status: values.some(v => !v.match) ? 'mismatch' : 'match',
        values,
      })
    } catch (err) {
      results.push({
        displayName: optionSet.displayName,
        status: 'error',
        values: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return results
}

export async function restoreOptionSets(
  client: AxiosInstance,
  config: ClientConfig
): Promise<{ restored: number; failed: number; details: OptionSetCheckResult[] }> {
  const checkResults = await checkOptionSets(client, config)
  let restored = 0
  let failed = 0

  const entitiesToPublish = new Set<string>()
  const globalsToPublish = new Set<string>()

  for (let i = 0; i < config.optionSets.length; i++) {
    const optionSet = config.optionSets[i]
    const check = checkResults[i]
    if (check.status === 'error' || check.status === 'match') continue

    for (const v of check.values) {
      if (v.match) continue
      try {
        if (optionSet.type === 'local') {
          await upsertLocalOptionValue(
            client,
            optionSet.entity!,
            optionSet.attribute!,
            v.value,
            v.expectedLabel,
            v.currentLabel !== null
          )
          entitiesToPublish.add(optionSet.entity!)
        } else {
          await upsertGlobalOptionValue(
            client,
            optionSet.name!,
            v.value,
            v.expectedLabel,
            v.currentLabel !== null
          )
          globalsToPublish.add(optionSet.name!)
        }
        restored++
      } catch {
        failed++
      }
    }
  }

  for (const entity of entitiesToPublish) {
    try { await publishEntity(client, entity) } catch { /* non-fatal */ }
  }
  for (const name of globalsToPublish) {
    try { await publishGlobalOptionSet(client, name) } catch { /* non-fatal */ }
  }

  const finalResults = await checkOptionSets(client, config)
  return { restored, failed, details: finalResults }
}
