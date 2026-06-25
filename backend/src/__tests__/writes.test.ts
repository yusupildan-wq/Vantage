import assert from 'node:assert/strict'
import type { AxiosInstance } from 'axios'
import { autoFixConnectionRef } from '../connectionrefs'
import { validateDevOpsUrl } from '../pipelines'

function makeClient(get: (url: string) => any, patch?: (url: string, body: any) => any): AxiosInstance {
  return {
    get:   async (url: string) => get(url),
    patch: async (url: string, body: any) => patch ? patch(url, body) : (() => { throw new Error('unexpected PATCH') })(),
  } as any
}

const BROKEN_ID  = 'ref-broken-001'
const HEALTHY_ID = 'ref-healthy-001'

const ALL_REFS = [
  {
    connectionreferenceid: BROKEN_ID,
    connectionreferencelogicalname: 'cr_sharepoint_broken',
    connectorid: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline',
    connectionid: null,
  },
  {
    connectionreferenceid: HEALTHY_ID,
    connectionreferencelogicalname: 'cr_sharepoint_healthy',
    connectorid: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline',
    connectionid: 'conn-abc123',
  },
]

async function run() {
  // -------------------------------------------------------------------
  // autoFixConnectionRef: target not found
  // -------------------------------------------------------------------
  {
    const client = makeClient(() => ({ data: { value: ALL_REFS } }))
    const r = await autoFixConnectionRef(client, 'ref-does-not-exist')
    assert.equal(r.success, false)
    assert.match(r.message, /not found/i)
    console.log('✓  target not found → success=false')
  }

  // -------------------------------------------------------------------
  // autoFixConnectionRef: already healthy
  // -------------------------------------------------------------------
  {
    const client = makeClient(() => ({ data: { value: ALL_REFS } }))
    const r = await autoFixConnectionRef(client, HEALTHY_ID)
    assert.equal(r.success, false)
    assert.match(r.message, /already healthy/i)
    console.log('✓  already healthy → success=false')
  }

  // -------------------------------------------------------------------
  // autoFixConnectionRef: no donor (no same-connector healthy ref)
  // -------------------------------------------------------------------
  {
    const isolated = [{
      connectionreferenceid: 'ref-teams-001',
      connectionreferencelogicalname: 'cr_teams',
      connectorid: '/providers/Microsoft.PowerApps/apis/shared_teams',
      connectionid: null,
    }]
    const client = makeClient(() => ({ data: { value: isolated } }))
    const r = await autoFixConnectionRef(client, 'ref-teams-001')
    assert.equal(r.success, false)
    assert.match(r.message, /no healthy/i)
    console.log('✓  no donor → success=false with descriptive message')
  }

  // -------------------------------------------------------------------
  // autoFixConnectionRef: happy path — PATCH called with correct URL + body
  // -------------------------------------------------------------------
  {
    let patchedUrl = ''
    let patchedBody: any = null
    const client = makeClient(
      () => ({ data: { value: ALL_REFS } }),
      (url, body) => { patchedUrl = url; patchedBody = body; return { data: {} } }
    )
    const r = await autoFixConnectionRef(client, BROKEN_ID)
    assert.equal(r.success, true)
    assert.match(r.message, /cr_sharepoint_healthy/i)
    assert.equal(r.donorName, 'cr_sharepoint_healthy')
    assert.match(patchedUrl, new RegExp(BROKEN_ID))
    assert.equal(patchedBody?.connectionid, 'conn-abc123')
    console.log('✓  happy path → PATCHes correct URL and donor connectionid')
  }

  // -------------------------------------------------------------------
  // autoFixConnectionRef: Dataverse PATCH throws (e.g. 403)
  // -------------------------------------------------------------------
  {
    const client = makeClient(
      () => ({ data: { value: ALL_REFS } }),
      () => {
        const err: any = new Error('InsufficientPrivilege')
        err.response = { data: { error: { message: 'Principal user lacks privilege' } } }
        throw err
      }
    )
    const r = await autoFixConnectionRef(client, BROKEN_ID)
    assert.equal(r.success, false)
    assert.match(r.message, /Principal user lacks privilege/)
    console.log('✓  Dataverse 403 → error message surfaced in result')
  }

  // -------------------------------------------------------------------
  // validateDevOpsUrl: valid URLs
  // -------------------------------------------------------------------
  {
    const valid = [
      'https://dev.azure.com/myorg/myproject',
      'https://dev.azure.com/my-org/my-project',
      'https://myorg.visualstudio.com/DefaultCollection/myproject',
    ]
    for (const url of valid) {
      assert.doesNotThrow(() => validateDevOpsUrl(url))
    }
    console.log('✓  validateDevOpsUrl: accepts valid DevOps URLs')
  }

  // -------------------------------------------------------------------
  // validateDevOpsUrl: invalid URLs
  // -------------------------------------------------------------------
  {
    assert.throws(() => validateDevOpsUrl('http://dev.azure.com/org/proj'), /HTTPS/)
    console.log('✓  validateDevOpsUrl: rejects HTTP')

    assert.throws(() => validateDevOpsUrl('https://dev.azure.com/onlyone'), /organization and project/)
    console.log('✓  validateDevOpsUrl: rejects URL with no project segment')

    assert.throws(() => validateDevOpsUrl('https://github.com/org/repo'), /Azure DevOps/)
    console.log('✓  validateDevOpsUrl: rejects non-DevOps hostname')

    assert.throws(() => validateDevOpsUrl('not-a-url'), /Invalid/)
    console.log('✓  validateDevOpsUrl: rejects garbage input')
  }

  console.log('\nAll write-operation tests passed.')
}

run().catch(err => { console.error(err); process.exit(1) })
