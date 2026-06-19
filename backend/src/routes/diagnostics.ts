import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { validateEnvironmentUrl } from '../auth'

export const diagnosticsRouter = Router()

type DiagnosticStatus = 'pass' | 'warn' | 'fail'

interface DiagnosticCheck {
  id: string
  label: string
  category: 'Backend' | 'Security' | 'Dataverse' | 'Azure DevOps' | 'Configuration'
  status: DiagnosticStatus
  message: string
  detail?: string
}

function isSet(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function checkEnv(name: string, label: string, category: DiagnosticCheck['category'], required = true): DiagnosticCheck {
  const present = isSet(name)
  return {
    id: name.toLowerCase(),
    label,
    category,
    status: present ? 'pass' : required ? 'fail' : 'warn',
    message: present ? 'Configured' : required ? 'Missing required environment variable' : 'Not configured',
  }
}

function getClientConfigCheck(): DiagnosticCheck {
  const configDir = path.resolve(__dirname, '../../../config/clients')
  try {
    const files = fs.readdirSync(configDir).filter(file => file.endsWith('.json'))
    if (files.length === 0) {
      return {
        id: 'client-configs',
        label: 'Client Config Files',
        category: 'Configuration',
        status: 'warn',
        message: 'No client config files found',
        detail: configDir,
      }
    }

    const invalid: string[] = []
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(configDir, file), 'utf8')
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed.optionSets)) invalid.push(file)
      } catch {
        invalid.push(file)
      }
    }

    if (invalid.length > 0) {
      return {
        id: 'client-configs',
        label: 'Client Config Files',
        category: 'Configuration',
        status: 'fail',
        message: `${invalid.length} config file(s) could not be loaded`,
        detail: invalid.join(', '),
      }
    }

    return {
      id: 'client-configs',
      label: 'Client Config Files',
      category: 'Configuration',
      status: 'pass',
      message: `${files.length} config file(s) loaded`,
      detail: files.join(', '),
    }
  } catch (err) {
    return {
      id: 'client-configs',
      label: 'Client Config Files',
      category: 'Configuration',
      status: 'fail',
      message: 'Could not read client config directory',
      detail: err instanceof Error ? err.message : configDir,
    }
  }
}

function getEnvironmentUrlCheck(url: unknown): DiagnosticCheck {
  if (!url || typeof url !== 'string') {
    return {
      id: 'environment-url-validation',
      label: 'Environment URL Validation',
      category: 'Dataverse',
      status: 'warn',
      message: 'No URL supplied',
      detail: 'Pass ?environmentUrl=https://org.crm.dynamics.com to validate a target URL.',
    }
  }

  try {
    validateEnvironmentUrl(url)
    return {
      id: 'environment-url-validation',
      label: 'Environment URL Validation',
      category: 'Dataverse',
      status: 'pass',
      message: 'URL is valid',
      detail: new URL(url).hostname,
    }
  } catch (err) {
    return {
      id: 'environment-url-validation',
      label: 'Environment URL Validation',
      category: 'Dataverse',
      status: 'fail',
      message: err instanceof Error ? err.message : 'Invalid environment URL',
    }
  }
}

function getAuditLogCheck(): DiagnosticCheck {
  const dataDir = path.resolve(__dirname, '../../../data')
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK)
    return {
      id: 'audit-log-storage',
      label: 'Audit Log Storage',
      category: 'Configuration',
      status: 'pass',
      message: 'Writable',
      detail: dataDir,
    }
  } catch (err) {
    return {
      id: 'audit-log-storage',
      label: 'Audit Log Storage',
      category: 'Configuration',
      status: 'fail',
      message: 'Audit log directory is not writable',
      detail: err instanceof Error ? err.message : dataDir,
    }
  }
}

diagnosticsRouter.get('/', (req, res) => {
  const checks: DiagnosticCheck[] = [
    {
      id: 'backend',
      label: 'Backend API',
      category: 'Backend',
      status: 'pass',
      message: 'Running',
      detail: `Port ${process.env.PORT ?? '3001'}`,
    },
    checkEnv('API_KEY', 'API Key', 'Security'),
    checkEnv('AZURE_TENANT_ID', 'Azure Tenant ID', 'Dataverse'),
    checkEnv('AZURE_CLIENT_ID', 'Azure Client ID', 'Dataverse'),
    checkEnv('AZURE_CLIENT_SECRET', 'Azure Client Secret', 'Dataverse'),
    checkEnv('AZURE_DEVOPS_PAT', 'Azure DevOps PAT', 'Azure DevOps', false),
    {
      id: 'optimizer-target-branch',
      label: 'Optimizer Target Branch',
      category: 'Azure DevOps',
      status: 'pass',
      message: process.env.OPTIMIZER_TARGET_BRANCH?.trim() || 'main',
    },
    {
      id: 'cors-origin',
      label: 'CORS Origin',
      category: 'Security',
      status: process.env.FRONTEND_URL?.trim() ? 'pass' : 'warn',
      message: process.env.FRONTEND_URL?.trim() ? 'Locked to configured frontend URL' : 'Using localhost development origins',
    },
    getClientConfigCheck(),
    getAuditLogCheck(),
    getEnvironmentUrlCheck(req.query.environmentUrl),
  ]

  const failures = checks.filter(check => check.status === 'fail').length
  const warnings = checks.filter(check => check.status === 'warn').length
  const overallStatus: DiagnosticStatus = failures > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass'

  res.json({
    timestamp: new Date().toISOString(),
    overallStatus,
    passed: checks.filter(check => check.status === 'pass').length,
    warnings,
    failures,
    checks,
  })
})
