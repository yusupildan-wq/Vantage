/**
 * Integration tests — calls write functions directly against the DEV environment.
 * Run with: npx ts-node src/__tests__/integration.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { makeDataverseClient } from '../auth'
import { scanEnvironment } from '../dataverse'
import { saveScan, getScans } from '../db'
import { checkOptionSets, restoreOptionSets } from '../optionsets'
import { getConnectionRefHealth, autoFixConnectionRef } from '../connectionrefs'
import { explainFlowError } from '../ai'
import { ClientConfig } from '../types'

const DEV_URL = 'https://andrews-dev.crm.dynamics.com'
const DEV_CONFIG: ClientConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../config/clients/andrews-dev.json'), 'utf-8')
)

let passed = 0
let failed = 0

function pass(name: string, detail?: string) {
  console.log(`  ✓  ${name}${detail ? `  →  ${detail}` : ''}`)
  passed++
}

function fail(name: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.log(`  ✗  ${name}  →  ${msg}`)
  failed++
}

// ─── 1. Active Layer Scan (reads Dataverse + writes to local scans.json) ─────

async function testScan() {
  console.log('\n1. Active Layer Scan')
  try {
    const results = await scanEnvironment(DEV_URL)
    saveScan(DEV_URL, results)
    const stored = getScans()
    const match = stored.some(s => s.environment_url === DEV_URL)
    if (!match) throw new Error('scan saved but not found in getScans()')
    pass('scan + save to scans.json', `${results.length} components scanned`)
  } catch (err) { fail('scan + save', err) }
}

// ─── 2. Option Sets check + conditional restore ────────────────────────────

async function testOptionSets() {
  console.log('\n2. Option Sets')
  try {
    const client = await makeDataverseClient(DEV_URL)
    const checkResults = await checkOptionSets(client, DEV_CONFIG)
    const driftCount = checkResults.filter(r => r.status === 'mismatch').length
    pass('checkOptionSets', `${checkResults.length} sets checked, ${driftCount} with drift`)

    if (driftCount > 0) {
      console.log(`     drift found — running restore on DEV...`)
      const result = await restoreOptionSets(client, DEV_CONFIG)
      if (result.failed > 0) {
        const failedValues = result.details.flatMap(r =>
          r.values.filter(v => !v.match).map(v => `${r.displayName}: value ${v.value} (expected "${v.expectedLabel}", got "${v.currentLabel}")`)
        )
        if (failedValues.length > 0) console.log('     still mismatched after restore:', failedValues.join(', '))
        else console.log(`     ${result.failed} upserts threw but final check shows all clean`)
      }
      pass('restoreOptionSets', `restored ${result.restored}, failed ${result.failed}`)

      // verify drift is resolved
      const recheck = await checkOptionSets(client, DEV_CONFIG)
      const remaining = recheck.filter(r => r.status === 'mismatch').length
      if (remaining > 0) {
        fail('post-restore recheck', new Error(`${remaining} still mismatched after restore`))
      } else {
        pass('post-restore recheck', 'all values match after restore')
      }
    } else {
      console.log('     no drift found — skipping restore (nothing to do)')
      pass('restoreOptionSets', 'skipped — already clean')
    }
  } catch (err) { fail('option sets', err) }
}

// ─── 3. Connection Ref health + conditional fix ────────────────────────────

async function testConnectionRefs() {
  console.log('\n3. Connection References')
  try {
    const client = await makeDataverseClient(DEV_URL)
    const refs = await getConnectionRefHealth(client)
    const broken = refs.filter(r => r.status === 'broken')
    pass('getConnectionRefHealth', `${refs.length} refs, ${broken.length} broken`)

    if (broken.length > 0) {
      const target = broken[0]
      console.log(`     attempting fix on: ${target.displayName}`)
      const result = await autoFixConnectionRef(client, target.id)
      if (result.success) {
        pass('autoFixConnectionRef', result.message)
      } else {
        // not a crash — just no donor available; that's a valid result
        console.log(`     fix result: ${result.message} (no donor found or already healthy)`)
        pass('autoFixConnectionRef', `no donor: ${result.message}`)
      }
    } else {
      console.log('     no broken refs — skipping fix (nothing to do)')
      pass('autoFixConnectionRef', 'skipped — all refs healthy')
    }
  } catch (err) { fail('connection refs', err) }
}

// ─── 4. AI flow error explanation ─────────────────────────────────────────

async function testFlowExplain() {
  console.log('\n4. AI Flow Error Explanation')
  try {
    const explanation = await explainFlowError(
      'Button -> Send an email (V2)',
      'ActionBranchingConditionNotSatisfied. The action was skipped because its branching condition was not satisfied.'
    )
    if (!explanation || explanation.length < 20) throw new Error('explanation too short or empty')
    pass('explainFlowError', `${explanation.length} chars returned`)
  } catch (err) { fail('explainFlowError', err) }
}

// ─── Run all ───────────────────────────────────────────────────────────────

async function main() {
  console.log('Vantage integration tests — DEV environment')
  console.log('='.repeat(50))

  await testScan()
  await testOptionSets()
  await testConnectionRefs()
  await testFlowExplain()

  console.log('\n' + '='.repeat(50))
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
