export type ComponentStatus = 'Active Layer' | 'Base Layer' | 'Unmanaged'

export interface ScanResult {
  id: string
  componentName: string
  componentType: string
  status: ComponentStatus
  message: string
}

export interface OptionSetValue {
  value: number
  label: string
}

export interface ProtectedOptionSet {
  type: 'global' | 'local'
  name?: string
  entity?: string
  attribute?: string
  displayName: string
  values: OptionSetValue[]
}

export interface ClientConfig {
  name: string
  environmentUrl: string
  optionSets: ProtectedOptionSet[]
}

export interface OptionSetValueStatus {
  value: number
  expectedLabel: string
  currentLabel: string | null
  match: boolean
}

export interface OptionSetCheckResult {
  displayName: string
  type: 'global' | 'local'
  entity?: string
  status: 'match' | 'mismatch' | 'error'
  values: OptionSetValueStatus[]
  error?: string
}
