export type ComponentStatus = 'Active Layer' | 'Base Layer' | 'Unmanaged'

export interface OptionSetValueStatus {
  value: number
  expectedLabel: string
  currentLabel: string | null
  match: boolean
}

export interface OptionSetCheckResult {
  displayName: string
  status: 'match' | 'mismatch' | 'error'
  values: OptionSetValueStatus[]
  error?: string
}

export interface ScanResult {
  id: string
  componentName: string
  componentType: string
  status: ComponentStatus
  message: string
}

export interface ScanState {
  environmentUrl: string
  isScanning: boolean
  results: ScanResult[]
  hasScanned: boolean
}
