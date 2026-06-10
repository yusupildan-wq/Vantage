export type ComponentStatus = 'Active Layer' | 'Base Layer' | 'Unmanaged'

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

export type CheckCategory =
  | 'Active Layer'
  | 'Option Sets'
  | 'Solutions'
  | 'Environment Variables'
  | 'Connection References'
  | 'Flows'

export interface ReadinessCheck {
  name: string
  category: CheckCategory
  status: 'pass' | 'warn' | 'fail' | 'skip'
  message: string
  details?: string[]
  remediation?: string
}

export interface ReadinessReport {
  environment: string
  timestamp: string
  overallStatus: 'READY' | 'NOT READY' | 'WARNINGS'
  passed: number
  warnings: number
  failures: number
  skipped: number
  checks: ReadinessCheck[]
}

export type FixType     = 'auto' | 'manual'
export type FixCategory = 'Cloud Flow' | 'Environment Variable' | 'Connection Reference'

export interface RemediationItem {
  id: string
  name: string
  category: FixCategory
  currentState: string
  proposedFix: string
  fixType: FixType
  deepLink?: string
}

export interface RemediationPlan {
  environmentUrl: string
  timestamp: string
  items: RemediationItem[]
  autoFixCount: number
  manualCount: number
}

export type DiffStatus = 'match' | 'different' | 'only_source' | 'only_target'

export type ComparisonCategory =
  | 'Solutions'
  | 'Environment Variables'
  | 'Connection References'
  | 'Cloud Flows'

export interface ComparisonItem {
  name: string
  status: DiffStatus
  sourceValue?: string
  targetValue?: string
}

export interface ComparisonSection {
  category: ComparisonCategory
  items: ComparisonItem[]
}

export interface ComparisonReport {
  sourceEnvironment: string
  targetEnvironment: string
  timestamp: string
  sections: ComparisonSection[]
  totalMatches: number
  totalDifferences: number
  totalSourceOnly: number
  totalTargetOnly: number
}
