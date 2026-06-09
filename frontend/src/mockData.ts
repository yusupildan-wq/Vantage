import { ScanResult } from './types'

export const MOCK_RESULTS: ScanResult[] = [
  {
    id: '1',
    componentName: 'account',
    componentType: 'Entity',
    status: 'Active Layer',
    message: 'Custom fields detected in active layer. Export may overwrite base solution.',
  },
  {
    id: '2',
    componentName: 'contact',
    componentType: 'Entity',
    status: 'Base Layer',
    message: 'No active-layer customizations found.',
  },
  {
    id: '3',
    componentName: 'new_customform',
    componentType: 'Form',
    status: 'Active Layer',
    message: 'Form layout modified outside of managed solution context.',
  },
  {
    id: '4',
    componentName: 'opportunity',
    componentType: 'Entity',
    status: 'Base Layer',
    message: 'No active-layer customizations found.',
  },
  {
    id: '5',
    componentName: 'new_businessrule_001',
    componentType: 'Business Rule',
    status: 'Active Layer',
    message: 'Business rule exists only in the active layer and will not be included in managed export.',
  },
  {
    id: '6',
    componentName: 'new_workflowapproval',
    componentType: 'Workflow',
    status: 'Unmanaged',
    message: 'Component is unmanaged and not associated with any solution.',
  },
  {
    id: '7',
    componentName: 'systemuser',
    componentType: 'Entity',
    status: 'Base Layer',
    message: 'No active-layer customizations found.',
  },
  {
    id: '8',
    componentName: 'new_dashboardsales',
    componentType: 'Dashboard',
    status: 'Active Layer',
    message: 'Dashboard components differ from the managed layer definition.',
  },
]
