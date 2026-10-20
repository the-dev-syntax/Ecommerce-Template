import { loadEnvConfig } from '@next/env'
import { cwd } from 'process'

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
