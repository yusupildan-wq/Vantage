export type ComponentStatus = 'Active Layer' | 'Base Layer' | 'Unmanaged'

export interface ScanResult {
  id: string
  componentName: string
  componentType: string
  status: ComponentStatus
  message: string
}
