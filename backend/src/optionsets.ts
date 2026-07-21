import { AxiosInstance } from 'axios'
import { ClientConfig, OptionSetCheckResult, OptionSetValueStatus } from './types'

interface OptionSetValueInfo {
  label: string
  isHidden: boolean
}

async function fetchLocalOptionSet(
  client: AxiosInstance,
  entity: string,
  attribute: string
): Promise<Map<number, OptionSetValueInfo>> {
  const base = `/EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${attribute}')`
  const types = [
    'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
    'Microsoft.Dynamics.CRM.StatusAttributeMetadata',
    'Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata',
  ]

  let options: Array<{
    Value: number
    Label: { LocalizedLabels: Array<{ Label: string; LanguageCode: number }> }
    IsHidden?: boolean
  }> | null = null

  for (const type of types) {
    try {
      const resp = await client.get(`${base}/${type}?$expand=OptionSet`)
      options = resp.data.OptionSet?.Options ?? null
      if (options) break
    } catch (err: unknown) {
      const status = (err as any)?.response?.status
      if (status !== 404) throw err
      // 404 means wrong type, try the next one
    }
  }

  if (!options) throw new Error(`Could not read option set for ${entity}.${attribute}`)

  const map = new Map<number, OptionSetValueInfo>()
  for (const opt of options) {
    const label =
      opt.Label.LocalizedLabels.find(l => l.LanguageCode === 1033)?.Label ??
      opt.Label.LocalizedLabels[0]?.Label ??
      ''
    map.set(opt.Value, { label, isHidden: opt.IsHidden === true })
  }
  return map
}

async function fetchGlobalOptionSet(
  client: AxiosInstance,
  name: string
): Promise<Map<number, OptionSetValueInfo>> {
  const resp = await client.get(`/GlobalOptionSetDefinitions(Name='${name}')`)
  const options: Array<{
    Value: number
    Label: { LocalizedLabels: Array<{ Label: string; LanguageCode: number }> }
    IsHidden?: boolean
  }> = resp.data.Options

  const map = new Map<number, OptionSetValueInfo>()
  for (const opt of options) {
    const label =
      opt.Label.LocalizedLabels.find(l => l.LanguageCode === 1033)?.Label ??
      opt.Label.LocalizedLabels[0]?.Label ??
      ''
    map.set(opt.Value, { label, isHidden: opt.IsHidden === true })
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

// NOTE: IsHidden as a write parameter on UpdateOptionValue is unverified against a
// live Dataverse tenant — it mirrors the read-side field name (confirmed accurate)
// but the write path itself has not been tested. Test against a non-production
// environment before relying on this.
async function setLocalOptionVisibility(
  client: AxiosInstance,
  entity: string,
  attribute: string,
  value: number,
  label: string,
  isHidden: boolean
): Promise<void> {
  await client.post('/UpdateOptionValue', {
    EntityLogicalName: entity,
    AttributeLogicalName: attribute,
    Value: value,
    Label: makeLabel(label),
    IsHidden: isHidden,
    MergeLabels: false,
  })
}

async function setGlobalOptionVisibility(
  client: AxiosInstance,
  name: string,
  value: number,
  label: string,
  isHidden: boolean
): Promise<void> {
  await client.post('/UpdateOptionValue', {
    OptionSetName: name,
    Value: value,
    Label: makeLabel(label),
    IsHidden: isHidden,
    MergeLabels: false,
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
  config: ClientConfig,
  sourceClient?: AxiosInstance
): Promise<OptionSetCheckResult[]> {
  const results: OptionSetCheckResult[] = []

  for (const optionSet of config.optionSets) {
    try {
      const currentValues =
        optionSet.type === 'local'
          ? await fetchLocalOptionSet(client, optionSet.entity!, optionSet.attribute!)
          : await fetchGlobalOptionSet(client, optionSet.name!)

      let values: OptionSetValueStatus[]

      if (sourceClient) {
        const sourceValues =
          optionSet.type === 'local'
            ? await fetchLocalOptionSet(sourceClient, optionSet.entity!, optionSet.attribute!)
            : await fetchGlobalOptionSet(sourceClient, optionSet.name!)

        values = Array.from(sourceValues.entries()).map(([value, source]) => {
          const current = currentValues.get(value)
          return {
            value,
            expectedLabel: source.label,
            currentLabel: current?.label ?? null,
            match: current?.label === source.label,
            isHidden: current?.isHidden ?? null,
          }
        })
      } else {
        values = optionSet.values.map(v => {
          const current = currentValues.get(v.value)
          return {
            value: v.value,
            expectedLabel: v.label,
            currentLabel: current?.label ?? null,
            match: current?.label === v.label,
            isHidden: current?.isHidden ?? null,
          }
        })
      }

      results.push({
        displayName: optionSet.displayName,
        type: optionSet.type,
        entity: optionSet.entity,
        status: values.some(v => !v.match) ? 'mismatch' : 'match',
        values,
      })
    } catch (err) {
      results.push({
        displayName: optionSet.displayName,
        type: optionSet.type,
        entity: optionSet.entity,
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
  config: ClientConfig,
  sourceClient?: AxiosInstance
): Promise<{ restored: number; failed: number; details: OptionSetCheckResult[] }> {
  const checkResults = await checkOptionSets(client, config, sourceClient)
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

  const finalResults = await checkOptionSets(client, config, sourceClient)
  return { restored, failed, details: finalResults }
}

export async function syncOptionSetVisibility(
  sourceClient: AxiosInstance,
  sourceConfig: ClientConfig,
  targetClient: AxiosInstance,
  targetConfig: ClientConfig
): Promise<{ updated: number; failed: number; skipped: number }> {
  const sourceResults = await checkOptionSets(sourceClient, sourceConfig)
  const targetResults = await checkOptionSets(targetClient, targetConfig)

  let updated = 0
  let failed = 0
  let skipped = 0

  const entitiesToPublish = new Set<string>()
  const globalsToPublish = new Set<string>()

  for (const targetOptionSet of targetConfig.optionSets) {
    const sourceResult = sourceResults.find(r => r.displayName === targetOptionSet.displayName)
    const targetResult = targetResults.find(r => r.displayName === targetOptionSet.displayName)
    if (!sourceResult || !targetResult || sourceResult.status === 'error' || targetResult.status === 'error') {
      skipped++
      continue
    }

    const sourceByValue = new Map(sourceResult.values.map(v => [v.value, v]))

    for (const targetValue of targetResult.values) {
      const sourceValue = sourceByValue.get(targetValue.value)
      // Skip when either side's visibility is unknown, the value doesn't exist in
      // the source, the value doesn't yet exist in the target, or visibility already matches.
      if (!sourceValue || sourceValue.isHidden === null || targetValue.isHidden === null) { skipped++; continue }
      if (targetValue.currentLabel === null) { skipped++; continue }
      if (sourceValue.isHidden === targetValue.isHidden) continue

      try {
        if (targetOptionSet.type === 'local') {
          await setLocalOptionVisibility(
            targetClient,
            targetOptionSet.entity!,
            targetOptionSet.attribute!,
            targetValue.value,
            targetValue.currentLabel,
            sourceValue.isHidden
          )
          entitiesToPublish.add(targetOptionSet.entity!)
        } else {
          await setGlobalOptionVisibility(
            targetClient,
            targetOptionSet.name!,
            targetValue.value,
            targetValue.currentLabel,
            sourceValue.isHidden
          )
          globalsToPublish.add(targetOptionSet.name!)
        }
        updated++
      } catch {
        failed++
      }
    }
  }

  for (const entity of entitiesToPublish) {
    try { await publishEntity(targetClient, entity) } catch { /* non-fatal */ }
  }
  for (const name of globalsToPublish) {
    try { await publishGlobalOptionSet(targetClient, name) } catch { /* non-fatal */ }
  }

  return { updated, failed, skipped }
}
