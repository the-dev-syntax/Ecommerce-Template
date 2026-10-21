import fs from 'node:fs'
import path from 'node:path'
import { cwd } from 'node:process'
import { randomUUID } from 'node:crypto'

import { loadEnvConfig } from '@next/env'
import data from '../lib/data'
import type { IInvoice } from '../lib/db/models/invoice.model'
import type { IZatcaSubmission } from '../lib/db/models/zatca.model'
import { allocateRefundToLines } from '../lib/invoices/credit-note'
import { getCertificateVat, getZatcaCredentials, getZatcaEnvironment, loadZatcaEgs } from '../lib/zatca/config'
import { buildZatcaInvoice } from '../lib/zatca/invoice-builder'

loadEnvConfig(cwd())

/**
 * End-to-end ZATCA sandbox/production verification of the app's real invoice path:
 * build the UBL document from an invoice snapshot, sign it with the stored EGS
 * credentials, report it, then report a credit note that chains to it.
 *
 *   npm run zatca:verify
 *
 * This never writes to MongoDB and never advances the stored ICV/PIH, so it is
 * safe to run repeatedly on the sandbox. Production is refused by default
 * because reporting real documents twice would corrupt the live chain.
 */

type StoredState = {
  previousInvoiceHash?: string
  invoiceCounter?: number
}

function parseState(raw: string): StoredState {
  const trimmed = raw.trim()
  return JSON.parse(
    trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8')
  ) as StoredState
}

function storedState(): StoredState {
  const raw = process.env.ZATCA_EGS_STATE?.trim()
  if (raw) return parseState(raw)

  const file = path.resolve(
    cwd(),
    process.env.ZATCA_EGS_STATE_FILE?.trim() || '.secrets/zatca-state.json'
  )
  if (!fs.existsSync(file)) {
    throw new Error('ZATCA_EGS_STATE is missing and no local state file exists')
  }
  return parseState(fs.readFileSync(file, 'utf8'))
}

function sellerSnapshot() {
  return data.settings[0].seller
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

function baseInvoice(seller: ReturnType<typeof sellerSnapshot>): IInvoice {
  return {
    _id: 'verify-invoice',
    number: `VERIFY-${Date.now()}`,
    type: 'invoice',
    currency: 'SAR',
    issuedAt: new Date(),
    seller,
    buyer: { name: 'Sandbox Buyer' },
    items: [
      {
        name: 'Verification item',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
        taxCategory: 'S',
        exemptionReasonCode: '',
        vatPercent: 15,
        vatAmount: 15,
      },
    ],
    itemsPrice: 100,
    shippingPrice: 10,
    vatAmount: 15,
    total: 125,
    qrPayload: '',
  } as unknown as IInvoice
}

function creditNote(original: IInvoice): IInvoice {
  const refund = 5
  const lines = allocateRefundToLines(
    [
      ...original.items.map((item) => ({
        name: item.name,
        lineTotal: item.lineTotal,
        vatAmount: item.vatAmount,
        taxCategory: item.taxCategory,
        exemptionReasonCode: item.exemptionReasonCode,
        vatPercent: item.vatPercent,
      })),
      {
        name: 'Shipping',
        lineTotal: original.shippingPrice,
        vatAmount: 0,
        taxCategory: 'O' as const,
        exemptionReasonCode: '',
        vatPercent: 0,
      },
    ],
    refund,
    original.total
  )
  const vatAmount = lines.reduce((sum, line) => sum + line.vatAmount, 0)

  return {
    ...original,
    _id: 'verify-credit-note',
    number: `${original.number}-CN`,
    type: 'credit_note',
    items: lines,
    itemsPrice: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    shippingPrice: 0,
    vatAmount,
    total: refund,
    refundedAmount: refund,
    originalInvoiceNumber: original.number,
    notes: 'Sandbox verification refund',
  }
}

async function report(
  submission: IZatcaSubmission,
  invoice: IInvoice,
  credentials: Awaited<ReturnType<typeof getZatcaCredentials>>,
  env: ReturnType<typeof getZatcaEnvironment>
) {
  const { createAPIClient, decodeTLVString, reportInvoice, signInvoice } =
    await import('zatca-sdk')
  const built = buildZatcaInvoice(invoice, submission)
  const signed = await signInvoice(built, {
    credentials: {
      certificate: credentials.certificate,
      privateKey: credentials.privateKey,
    },
    previousInvoiceHash: submission.pih,
    allowCertificateKeyMismatch: env === 'sandbox',
    skipQrImage: true,
  })
  if (!signed.success) throw signed.error

  const client = createAPIClient({
    env,
    certificate: credentials.certificate,
    secret: credentials.secret,
  })
  const response = await reportInvoice(client, {
    invoiceHash: signed.data.invoiceHash,
    uuid: submission.uuid,
    invoice: Buffer.from(signed.data.signedXml, 'utf8').toString('base64'),
  })

  if (!response.success) {
    const apiError = response.error as Error & {
      statusCode?: number
      zatcaErrors?: unknown[]
    }
    for (const error of apiError.zatcaErrors ?? []) {
      console.error('  ZATCA ERROR:', error)
    }
    throw apiError
  }

  const validation = response.data.validationResults
  for (const warning of validation?.warningMessages ?? []) {
    console.warn(`  WARN ${warning.code}: ${warning.message}`)
  }
  for (const error of validation?.errorMessages ?? []) {
    console.error(`  ERROR ${error.code}: ${error.message}`)
  }

  const reported =
    response.data.reportingStatus === 'REPORTED' ||
    response.data.reportingStatus === undefined
  if (!reported || (validation?.errorMessages?.length ?? 0) > 0) {
    throw new Error(
      `ZATCA rejected ${submission.type} (${response.data.reportingStatus ?? 'unknown'})`
    )
  }

  const qr = decodeTLVString(signed.data.qrTlvBase64)
  if (!qr.success) throw qr.error
  const requiredTags = [
    'sellerName',
    'vatNumber',
    'timestamp',
    'invoiceTotal',
    'vatTotal',
    'invoiceHash',
    'digitalSignature',
    'publicKey',
    'certificateSignature',
  ] as const
  for (const tag of requiredTags) {
    if (!qr.data[tag]) throw new Error(`QR TLV field ${tag} is missing`)
  }

  return {
    invoiceHash: signed.data.invoiceHash,
    icv: submission.icv,
    warningCount: validation?.warningMessages?.length ?? 0,
  }
}

async function main() {
  const { INITIAL_PREVIOUS_HASH } = await import('zatca-sdk')
  const env = getZatcaEnvironment()
  if (env === 'production' && !process.argv.includes('--allow-production')) {
    throw new Error(
      'Refusing to report real production invoices: this check does not advance the live ICV/PIH. Use the sandbox, or pass --allow-production only with a dedicated test EGS.'
    )
  }
  const meta = storedState()
  const startIcv = (meta.invoiceCounter ?? 0) + 1
  const startPih = meta.previousInvoiceHash || INITIAL_PREVIOUS_HASH
  const egs = await loadZatcaEgs()
  const credentials = await getZatcaCredentials(egs)

  let seller = sellerSnapshot()
  if (env === 'sandbox') {
    const certificateVat = await getCertificateVat(credentials.certificate)
    if (certificateVat && certificateVat !== seller.vatNumber) {
      console.warn(
        `  Sandbox certificate is registered to VAT ${certificateVat}; using it for this run (production keeps ${seller.vatNumber}).`
      )
      seller = { ...seller, vatNumber: certificateVat }
    }
  }

  console.log(`ZATCA ${env} end-to-end verification`)
  console.log(`  Chain start: ICV ${startIcv}, PIH ${startPih.slice(0, 12)}...`)

  const invoice = baseInvoice(seller)
  console.log('\n1. Simplified tax invoice (gross 115 + shipping 10)')
  const invoiceSubmission = {
    uuid: randomUUID(),
    icv: startIcv,
    pih: startPih,
    type: 'invoice',
  } as unknown as IZatcaSubmission
  const invoiceResult = await report(
    invoiceSubmission,
    invoice,
    credentials,
    env
  )
  console.log(
    `  REPORTED ICV ${invoiceResult.icv}, hash ${invoiceResult.invoiceHash.slice(0, 16)}...`
  )

  console.log('\n2. Credit note (5 SAR refund, chained to the invoice)')
  const note = creditNote(invoice)
  const noteSubmission = {
    uuid: randomUUID(),
    icv: startIcv + 1,
    pih: invoiceResult.invoiceHash,
    type: 'credit_note',
  } as unknown as IZatcaSubmission
  const noteResult = await report(noteSubmission, note, credentials, env)
  console.log(
    `  REPORTED ICV ${noteResult.icv}, hash ${noteResult.invoiceHash.slice(0, 16)}...`
  )
  console.log(
    `  Net ${note.itemsPrice.toFixed(2)} + VAT ${note.vatAmount.toFixed(2)} = ${note.total.toFixed(2)}`
  )

  console.log('\nPASS: invoice and credit note were accepted by ZATCA.')
  console.log(
    'The stored ICV/PIH was not advanced by this check; the application queue owns the live chain.'
  )
}

main().catch((error) => {
  console.error(
    '\nZATCA verification failed:',
    error instanceof Error ? error.message : error
  )
  if (error instanceof Error) console.error(error.stack)
  process.exitCode = 1
})
