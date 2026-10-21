import { loadEnvConfig } from '@next/env'
import { cwd } from 'process'

import type { EGSState, EGSUnitInfo } from 'zatca-sdk'

loadEnvConfig(cwd())

const failures: string[] = []
const warnings: string[] = []

function requireValue(name: string) {
  if (!process.env[name]?.trim()) failures.push(`${name} is missing`)
}

function requireNoPrefix(name: string, prefix: string) {
  const value = process.env[name]
  if (value?.startsWith(prefix))
    failures.push(`${name} still uses a sandbox/test key (${prefix}...)`)
}

function parseEgsState(raw: string) {
  const trimmed = raw.trim()
  const json = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8')
  return JSON.parse(json) as {
    env?: string
    egsUnit?: EGSUnitInfo
    egsState?: EGSState
  }
}

async function checkZatcaState() {
  const egsRaw = process.env.ZATCA_EGS_STATE?.trim()
  if (!egsRaw) return

  const { validateCredentials } = await import('zatca-sdk')

  try {
    const state = parseEgsState(egsRaw)
    if (!state.egsUnit || !state.egsState) {
      failures.push('ZATCA_EGS_STATE must include egsUnit and egsState')
    }
    if (state.env && state.env !== 'production') {
      failures.push(
        `ZATCA_EGS_STATE contains ${state.env} credentials, not production credentials`
      )
    }
    if (
      !state.egsState?.productionCertificate ||
      !state.egsState?.productionSecret
    ) {
      failures.push(
        'ZATCA_EGS_STATE has no production CSID; finish production onboarding first'
      )
    }
    for (const [label, value] of [
      ['egsUnit.uuid', state.egsUnit?.uuid],
      ['egsUnit.commonName', state.egsUnit?.commonName],
      ['egsUnit.vatNumber', state.egsUnit?.vatNumber],
      ['egsUnit.location', state.egsUnit?.location],
    ] as const) {
      if (!value?.trim()) failures.push(`ZATCA_EGS_STATE ${label} is missing`)
    }
    if (
      state.egsUnit?.vatNumber &&
      !/^3\d{13}3$/.test(state.egsUnit.vatNumber)
    ) {
      failures.push(
        `ZATCA_EGS_STATE VAT number "${state.egsUnit.vatNumber}" is not 15 digits`
      )
    }
    if (state.egsState?.productionCertificate) {
      const validity = validateCredentials(state.egsState.productionCertificate)
      if (!validity.success) {
        failures.push(
          `ZATCA production certificate is invalid: ${validity.error.message}`
        )
      } else if (!validity.data.valid) {
        failures.push('ZATCA production certificate is expired or not yet valid')
      } else if (validity.data.daysUntilExpiry <= 30) {
        warnings.push(
          `ZATCA production certificate expires in ${validity.data.daysUntilExpiry} days; renew it`
        )
      }
    }
  } catch (error) {
    failures.push(
      `ZATCA_EGS_STATE is not valid JSON/base64: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

async function main() {
  requireValue('MONGODB_URI')
  requireValue('AUTH_SECRET')
  requireValue('MOYASAR_SECRET_KEY')
  requireValue('MOYASAR_WEBHOOK_SECRET')
  requireValue('ZATCA_EGS_STATE')

  requireNoPrefix('MOYASAR_PUBLISHABLE_KEY', 'pk_test_')
  requireNoPrefix('NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY', 'pk_test_')
  requireNoPrefix('MOYASAR_SECRET_KEY', 'sk_test_')
  requireNoPrefix('STRIPE_SECRET_KEY', 'sk_test_')
  requireNoPrefix('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_')

  if (process.env.PAYPAL_API_URL?.includes('sandbox')) {
    failures.push('PAYPAL_API_URL still points to the PayPal sandbox')
  }

  if (process.env.ZATCA_ENV !== 'production') {
    failures.push('ZATCA_ENV must be "production"')
  }

  await checkZatcaState()

  if (process.env.ZATCA_SANDBOX_BASE_URL) {
    warnings.push('ZATCA_SANDBOX_BASE_URL is still set (unused in production)')
  }

  if (process.env.ZATCA_SANDBOX_OTP) {
    warnings.push('ZATCA_SANDBOX_OTP is still set; remove it after onboarding')
  }

  for (const warning of warnings) console.warn('WARN:', warning)

  if (failures.length > 0) {
    for (const failure of failures) console.error('FAIL:', failure)
    process.exitCode = 1
  } else {
    console.log('Production environment checks passed.')
  }
}

main().catch((error) => {
  console.error(
    'Production environment check failed:',
    error instanceof Error ? error.message : error
  )
  process.exitCode = 1
})
