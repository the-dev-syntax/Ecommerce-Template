import crypto from 'crypto'

import { connectToDatabase } from '@/lib/db'
import Invoice, { IInvoice } from '@/lib/db/models/invoice.model'
import {
  IZatcaSubmission,
  ZatcaChainState,
  ZatcaSubmission,
} from '@/lib/db/models/zatca.model'

import { getZatcaCredentials, getZatcaEnvironment, loadZatcaEgs } from './config'
import { buildZatcaInvoice } from './invoice-builder'

const LOCK_MS = 2 * 60 * 1000

function chainKey(environment: 'sandbox' | 'production') {
  return `chain:${environment}`
}

async function getOrCreateChainState(environment: 'sandbox' | 'production') {
  const key = chainKey(environment)
  const { INITIAL_PREVIOUS_HASH } = await import('zatca-sdk')
  try {
    await ZatcaChainState.updateOne(
      { _id: key },
      {
        $setOnInsert: {
          environment,
          nextIcv: 1,
          lastAcceptedHash: INITIAL_PREVIOUS_HASH,
          lockOwner: null,
          lockExpiresAt: null,
        },
      },
      { upsert: true }
    )
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
  }
  return key
}

async function acquireLock(environment: 'sandbox' | 'production') {
  const key = await getOrCreateChainState(environment)
  const now = new Date()
  const owner = crypto.randomUUID()

  const state = await ZatcaChainState.findOneAndUpdate(
    {
      _id: key,
      $or: [
        { lockOwner: null },
        { lockOwner: { $exists: false } },
        { lockExpiresAt: null },
        { lockExpiresAt: { $lt: now } },
      ],
    },
    {
      $set: {
        lockOwner: owner,
        lockExpiresAt: new Date(now.getTime() + LOCK_MS),
      },
    },
    { new: true }
  )

  return state ? { state, owner, key } : null
}

async function releaseLock(key: string, owner: string) {
  await ZatcaChainState.updateOne(
    { _id: key, lockOwner: owner },
    { $set: { lockOwner: null, lockExpiresAt: null } }
  )
}

export async function ensureZatcaSubmission(invoiceId: string) {
  await connectToDatabase()

  const existing = await ZatcaSubmission.findOne({ invoiceId: String(invoiceId) })
  if (existing) return existing

  const invoice = await Invoice.findById(invoiceId).lean()
  if (!invoice) throw new Error('Invoice not found')

  try {
    return await ZatcaSubmission.create({
      invoiceId: String(invoiceId),
      orderId: String(invoice.orderId),
      type: invoice.type,
      environment: getZatcaEnvironment(),
      uuid: crypto.randomUUID(),
      status: 'queued',
      attempts: 0,
    })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await ZatcaSubmission.findOne({
        invoiceId: String(invoiceId),
      })
      if (duplicate) return duplicate
    }
    throw error
  }
}

export async function getZatcaSubmission(invoiceId: string) {
  await connectToDatabase()
  return ZatcaSubmission.findOne({ invoiceId: String(invoiceId) }).lean()
}

/**
 * Queue and (best effort) report an invoice. ZATCA outages never block the
 * order: the signed/queued submission is retried later.
 */
export async function queueZatcaForInvoice(invoiceId: string) {
  try {
    await ensureZatcaSubmission(invoiceId)
    await processZatcaQueue()
  } catch (error) {
    console.error(
      'ZATCA queue failed (the submission remains queued for retry):',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

async function markFailed(
  submission: IZatcaSubmission,
  error: unknown
) {
  submission.status = 'failed'
  submission.zatcaErrors = [
    {
      type: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  ]
  await submission.save()
}

async function signAndReport(
  submission: IZatcaSubmission,
  invoice: IInvoice
) {
  const environment = getZatcaEnvironment()

  if (!submission.icv || !submission.pih) {
    throw new Error('ZATCA submission is missing ICV/PIH')
  }

  let signedXml = submission.signedXml
  let invoiceHash = submission.invoiceHash
  let qrPayload = submission.qrPayload

  if (!signedXml || !invoiceHash) {
    const egs = await loadZatcaEgs()
    const credentials = await getZatcaCredentials(egs)
    const { signInvoice } = await import('zatca-sdk')
    const zatcaInvoice = buildZatcaInvoice(invoice, submission)
    const signed = await signInvoice(zatcaInvoice, {
      credentials: {
        certificate: credentials.certificate,
        privateKey: credentials.privateKey,
      },
      previousInvoiceHash: submission.pih,
      allowCertificateKeyMismatch: environment === 'sandbox',
      skipQrImage: true,
    })

    if (!signed.success) throw signed.error

    signedXml = signed.data.signedXml
    invoiceHash = signed.data.invoiceHash
    qrPayload = signed.data.qrTlvBase64

    submission.signedXml = signedXml
    submission.invoiceHash = invoiceHash
    submission.qrPayload = qrPayload
    submission.status = 'pending'
    submission.attempts += 1
    await submission.save()
  }

  const egs = await loadZatcaEgs()
  const credentials = await getZatcaCredentials(egs)
  const { createAPIClient, reportInvoice } = await import('zatca-sdk')
  const client = createAPIClient({
    env: environment,
    certificate: credentials.certificate,
    secret: credentials.secret,
  })

  const response = await reportInvoice(client, {
    invoiceHash,
    uuid: submission.uuid,
    invoice: Buffer.from(signedXml, 'utf8').toString('base64'),
  })

  if (!response.success) {
    const apiError = response.error as Error & {
      statusCode?: number
      zatcaErrors?: unknown[]
    }
    // A 400 with validation errors is a rejection; everything else is retryable.
    if (apiError.statusCode === 400) {
      submission.status = 'rejected'
      submission.zatcaErrors = apiError.zatcaErrors ?? [
        { type: 'ERROR', message: apiError.message },
      ]
      await submission.save()
      return { accepted: false, retryable: false }
    }

    submission.status = 'failed'
    submission.zatcaErrors = apiError.zatcaErrors ?? [
      { type: 'ERROR', message: apiError.message },
    ]
    await submission.save()
    return { accepted: false, retryable: true }
  }

  const validation = response.data.validationResults
  const errors = validation?.errorMessages ?? []
  const warnings = validation?.warningMessages ?? []
  const accepted =
    errors.length === 0 &&
    (response.data.reportingStatus === 'REPORTED' ||
      response.data.reportingStatus === undefined)

  submission.zatcaWarnings = warnings
  submission.zatcaErrors = errors
  submission.reportedAt = new Date()
  submission.status = accepted ? 'accepted' : 'rejected'
  await submission.save()

  return { accepted, retryable: !accepted }
}

export async function processZatcaQueue(limit = 5) {
  await connectToDatabase()

  let environment: 'sandbox' | 'production'
  try {
    environment = getZatcaEnvironment()
  } catch {
    return
  }

  const lock = await acquireLock(environment)
  if (!lock) return

  try {
    for (let index = 0; index < limit; index++) {
      const submission = await ZatcaSubmission.findOne({
        environment,
        status: { $in: ['queued', 'pending'] },
      }).sort({ createdAt: 1 })

      if (!submission) break

      const invoice = await Invoice.findById(submission.invoiceId).lean()
      if (!invoice) {
        await markFailed(submission, new Error('Invoice not found'))
        break
      }

      const state = lock.state
      if (!submission.icv || !submission.pih) {
        submission.icv = state.nextIcv
        submission.pih = state.lastAcceptedHash
        await submission.save()
      }

      try {
        const result = await signAndReport(
          submission,
          JSON.parse(JSON.stringify(invoice)) as IInvoice
        )

        if (result.accepted) {
          state.nextIcv = (submission.icv ?? state.nextIcv) + 1
          state.lastAcceptedHash = submission.invoiceHash ?? state.lastAcceptedHash
          await state.save()
          continue
        }

        // Rejected/failed submissions preserve ICV/PIH and signed XML so the
        // admin can retry the same document without creating a new chain entry.
        break
      } catch (error) {
        await markFailed(submission, error)
        break
      }
    }
  } finally {
    await releaseLock(lock.key, lock.owner)
  }
}

export async function retryZatcaSubmission(invoiceId: string) {
  await connectToDatabase()
  await ensureZatcaSubmission(invoiceId)
  await ZatcaSubmission.updateOne(
    { invoiceId: String(invoiceId) },
    {
      $set: {
        status: 'queued',
        zatcaErrors: [],
      },
    }
  )
  await processZatcaQueue()
}

