import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { decryptConfig, encryptConfig, VantageConfig } from '../config'
import { securityInternals } from '../security'

{
  const key = crypto.randomBytes(32)
  const config: VantageConfig = {
    AZURE_TENANT_ID: 'tenant',
    AZURE_CLIENT_ID: 'client',
    AZURE_CLIENT_SECRET: 'secret',
    AZURE_DEVOPS_PAT: 'pat',
    AI_DATA_CONSENT: true,
  }
  const encrypted = encryptConfig(config, key)
  assert.equal(JSON.stringify(encrypted).includes('secret'), false)
  assert.deepEqual(decryptConfig(encrypted, key), config)
}

{
  const key = crypto.randomBytes(32)
  const encrypted = encryptConfig({
    AZURE_TENANT_ID: 'tenant',
    AZURE_CLIENT_ID: 'client',
    AZURE_CLIENT_SECRET: 'secret',
  }, key)
  encrypted.ciphertext = `${encrypted.ciphertext.slice(0, -2)}AA`
  assert.throws(() => decryptConfig(encrypted, key))
}

{
  assert.deepEqual(
    securityInternals.parseCookies('alpha=one; vantage_session=two%20words'),
    { alpha: 'one', vantage_session: 'two words' }
  )
  assert.equal(securityInternals.safeEqual('same', 'same'), true)
  assert.equal(securityInternals.safeEqual('same', 'different'), false)
}

console.log('security tests passed')
