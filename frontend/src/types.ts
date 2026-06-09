export type ComponentStatus = 'Active Layer' | 'Base Layer' | 'Unmanaged'

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
