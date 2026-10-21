import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cwd } from 'node:process'

import { loadEnvConfig } from '@next/env'
import type {
  EGSUnitInfo,
  Invoice,
  Result,
  ValidationResults,
  ZATCAEnvironment,
} from 'zatca-sdk'

import data from '../lib/data'
import { connectToDatabase } from '../lib/db'
import Setting from '../lib/db/models/setting.model'
import { withSettingDefaults } from '../lib/settings-defaults'
import type { ISettingInput } from '../types'

loadEnvConfig(cwd())

/**
 * ZATCA EGS onboarding.
 *
 * Sandbox:
 *   npm run zatca:onboard
 * Production (real Fatoora OTP, after the OTP is generated in the portal):
 *   ZATCA_ENV=production ZATCA_OTP=123456 npm run zatca:onboard -- --force
 *
 * The private key and CSIDs are written to .secrets/zatca-state.json (gitignored).
 * Copy the printed ZATCA_EGS_STATE value into the deployment environment.
 */

type PersistedState = {
  env: ZATCAEnvironment
  egsUnit: EGSUnitInfo
  egsState: Record<string, unknown>
  previousInvoiceHash: string
  invoiceCounter: number
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for ZATCA onboarding`)
  return value
}

function environment(): ZATCAEnvironment {
  const value = process.env.ZATCA_ENV?.trim().toLowerCase()
  if (value === 'production') return 'production'
  if (value === 'sandbox' || !value) return 'sandbox'
  throw new Error('ZATCA_ENV must be "sandbox" or "production"')
}

function sellerFromSettings() {
  const seller = data.settings[0].seller
  if (!/^3\d{13}3$/.test(seller.vatNumber)) {
    throw new Error(
      `Seller VAT number "${seller.vatNumber}" is not a 15-digit ZATCA VAT number`
    )
  }
  return seller
}

async function loadSeller() {
  const fallback = sellerFromSettings()
  let seller = fallback
  try {
    await connectToDatabase()
    const raw = await Setting.findOne().lean()
    if (raw) {
      seller = withSettingDefaults(
        JSON.parse(JSON.stringify(raw)) as ISettingInput
      ).seller
    }
  } catch (error) {
    console.warn(
      'Could not read seller settings from MongoDB; using seed defaults:',
      error instanceof Error ? error.message : error
    )
    seller = fallback
  }
  if (!/^3\d{13}3$/.test(seller.vatNumber)) {
    throw new Error(
      `Seller VAT number "${seller.vatNumber}" is not a 15-digit ZATCA VAT number`
    )
  }
  return seller
}

function egsUnit(
  env: ZATCAEnvironment,
  seller: ReturnType<typeof sellerFromSettings>
): EGSUnitInfo {
  const uuid = process.env.ZATCA_EGS_UUID?.trim() || randomUUID()
  const model = process.env.ZATCA_EGS_MODEL?.trim() || 'EV-Web'
  const solutionName = process.env.ZATCA_SOLUTION_NAME?.trim() || 'EV-Web'
  const serial = `1-${solutionName}|2-${model}|3-${uuid}`
  const commonName =
    process.env.ZATCA_EGS_COMMON_NAME?.trim() ||
    (env === 'sandbox'
      ? `TST-${seller.crNumber || '0000000000'}-${seller.vatNumber}`
      : serial)

  return {
    uuid,
    model,
    branchName: process.env.ZATCA_EGS_BRANCH_NAME?.trim() || 'Main Branch',
    branchIndustry:
      process.env.ZATCA_EGS_BRANCH_INDUSTRY?.trim() || 'Retail',
    location:
      process.env.ZATCA_EGS_LOCATION?.trim() ||
      seller.nationalAddress ||
      seller.city,
    commonName,
    organizationName: seller.legalNameEn,
    countryCode: seller.country || 'SA',
    vatNumber: seller.vatNumber,
    invoiceType: process.env.ZATCA_EGS_INVOICE_TYPE?.trim() || '0100',
  }
}

function dateParts(date: Date) {
  const issueDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const issueTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
  return { issueDate, issueTime }
}

function complianceInvoice(
  unit: EGSUnitInfo,
  seller: ReturnType<typeof sellerFromSettings>,
  type: 'simplified' | 'standard',
  initialHash: string
): Invoice {
  const { issueDate, issueTime } = dateParts(new Date())
  const isStandard = type === 'standard'
  const line = {
    id: '1',
    name: 'Onboarding compliance item',
    quantity: 1,
    unitCode: 'PCE',
    unitPrice: 100,
    lineTotal: 100,
    vatCategory: 'S' as const,
    vatPercent: 15,
    vatAmount: 15,
  }

  return {
    id: `ONBOARD-${type}-${Date.now()}`,
    uuid: randomUUID(),
    issueDate,
    issueTime,
    invoiceTypeCode: '388',
    invoiceSubType: isStandard ? '0100000' : '0200000',
    documentCurrency: 'SAR',
    taxCurrency: 'SAR',
    invoiceCounterValue: 1,
    previousInvoiceHash: initialHash,
    seller: {
      registrationName: seller.legalNameEn,
      vatNumber: seller.vatNumber,
      identification: seller.crNumber
        ? { schemeId: 'CRN', value: seller.crNumber }
        : undefined,
      address: {
        street: seller.street,
        buildingNumber: seller.buildingNumber,
        plotIdentification: seller.nationalAddress || undefined,
        citySubdivision: seller.citySubdivision,
        city: seller.city,
        postalCode: seller.postalCode,
        country: seller.country || 'SA',
      },
    },
    buyer: isStandard
      ? {
          registrationName: 'Compliance Buyer',
          vatNumber: '311111111111113',
          address: {
            street: 'Compliance Street',
            buildingNumber: '1234',
            citySubdivision: 'Al Olaya',
            city: 'Riyadh',
            postalCode: '12211',
            country: 'SA',
          },
        }
      : undefined,
    paymentMeansCode: '10',
    actualDeliveryDate: issueDate,
    lineExtensionAmount: 100,
    taxExclusiveAmount: 100,
    taxInclusiveAmount: 115,
    allowanceTotalAmount: 0,
    prepaidAmount: 0,
    payableAmount: 115,
    taxTotal: 15,
    taxTotalInSAR: 15,
    taxSubtotals: [
      {
        taxableAmount: 100,
        taxAmount: 15,
        taxCategory: 'S',
        taxPercent: 15,
      },
    ],
    lines: [line],
    note: `ZATCA onboarding check (${unit.uuid})`,
  }
}

function assertCompliance(
  label: string,
  result: Result<ValidationResults>
) {
  if (!result.success) throw result.error
  const status = result.data.status
  const errors = result.data.errorMessages ?? []
  const warnings = result.data.warningMessages ?? []

  for (const warning of warnings) console.warn(`  WARN ${warning.code}: ${warning.message}`)
  if (status === 'ERROR' || errors.length > 0) {
    for (const error of errors) console.error(`  ERROR ${error.code}: ${error.message}`)
    throw new Error(`${label} compliance check failed (${status})`)
  }
  console.log(`  PASS ${label} compliance check (${status})`)
}

function stateFilePath() {
  return path.resolve(
    cwd(),
    process.env.ZATCA_EGS_STATE_FILE?.trim() || '.secrets/zatca-state.json'
  )
}

function writeState(file: string, state: PersistedState) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
}

async function main() {
  const { INITIAL_PREVIOUS_HASH, ZATCAClient } = await import('zatca-sdk')
  const env = environment()
  const force = process.argv.includes('--force')
  const skipCompliance = process.argv.includes('--no-compliance')
  const file = stateFilePath()

  if (fs.existsSync(file) && !force) {
    throw new Error(
      `${file} already exists. Re-run with --force only if you intend to replace the EGS keys and CSIDs.`
    )
  }
  if (skipCompliance && env !== 'sandbox') {
    throw new Error('--no-compliance is only allowed on the ZATCA sandbox')
  }

  const otp =
    env === 'sandbox'
      ? process.env.ZATCA_SANDBOX_OTP?.trim() ||
        process.env.ZATCA_OTP?.trim() ||
        '123456'
      : required('ZATCA_OTP')
  const seller = await loadSeller()
  const unit = egsUnit(env, seller)
  const solutionName = process.env.ZATCA_SOLUTION_NAME?.trim() || 'EV-Web'

  console.log(`Onboarding ${env} EGS ${unit.uuid}`)
  console.log(`  Seller: ${unit.organizationName} (VAT ${unit.vatNumber})`)
  console.log(`  Invoice type: ${unit.invoiceType}`)

  const client = new ZATCAClient({ egsUnit: unit, env, solutionName })

  const compliance = await client.startOnboarding(otp)
  if (!compliance.success) throw compliance.error
  console.log(`  Compliance CSID issued (request ${compliance.data.requestId})`)

  if (!skipCompliance) {
    const checks: Array<'simplified' | 'standard'> = []
    if (unit.invoiceType[1] === '1') checks.push('simplified')
    if (unit.invoiceType[0] === '1') checks.push('standard')
    if (checks.length === 0) {
      throw new Error(
        `invoiceType "${unit.invoiceType}" does not declare a simplified or standard invoice`
      )
    }
    for (const type of checks) {
      const result = await client.checkInvoiceCompliance(
        complianceInvoice(unit, seller, type, INITIAL_PREVIOUS_HASH)
      )
      assertCompliance(type, result)
    }
  }

  const production = await client.finishOnboarding()
  if (!production.success) throw production.error
  console.log(`  Production CSID issued (request ${production.data.requestId})`)

  const sdkState = client.getState()
  const state: PersistedState = {
    env,
    egsUnit: unit,
    egsState: sdkState.egsState as unknown as Record<string, unknown>,
    previousInvoiceHash: sdkState.previousInvoiceHash || INITIAL_PREVIOUS_HASH,
    invoiceCounter: sdkState.invoiceCounter ?? 0,
  }
  writeState(file, state)

  const encoded = Buffer.from(JSON.stringify(state)).toString('base64')
  console.log(`\nState written to ${file}`)
  console.log('Add this to the deployment environment (never commit it):')
  console.log(`ZATCA_EGS_STATE=${encoded}`)
  console.log(
    env === 'sandbox'
      ? '\nNext: npm run zatca:verify'
      : '\nNext: npm run zatca:verify (production) before accepting live orders'
  )
}

main().catch((error) => {
  console.error(
    'ZATCA onboarding failed:',
    error instanceof Error ? error.message : error
  )
  process.exitCode = 1
})
