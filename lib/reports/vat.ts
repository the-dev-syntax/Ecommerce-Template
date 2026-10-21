import Invoice from '@/lib/db/models/invoice.model'
import { connectToDatabase } from '@/lib/db'
import { round2 } from '@/lib/utils'

export interface VatReportFilters {
  from?: string
  to?: string
}

export interface VatReportRow {
  id: string
  number: string
  type: 'invoice' | 'credit_note'
  reason?: string
  issuedAt: Date
  orderId: string
  currency: string
  net: number
  vat: number
  gross: number
}

export interface VatReportSummary {
  net: number
  vat: number
  gross: number
  invoices: number
  creditNotes: number
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function getVatReport(filters: VatReportFilters) {
  await connectToDatabase()
  const from = parseDate(filters.from)
  const to = parseDate(filters.to, true)
  const query: Record<string, unknown> = {}
  if (from || to) {
    query.issuedAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    }
  }

  const invoices = await Invoice.find(query).sort({ issuedAt: 1 }).lean()
  const rows: VatReportRow[] = invoices.map((invoice) => ({
    id: String(invoice._id),
    number: invoice.number,
    type: invoice.type,
    reason: invoice.creditNoteReason,
    issuedAt: invoice.issuedAt,
    orderId: String(invoice.orderId),
    currency: invoice.currency,
    net: round2(invoice.itemsPrice),
    vat: round2(invoice.vatAmount),
    gross: round2(invoice.total),
  }))

  return { rows, summary: summarizeVatReport(rows) }
}

export function summarizeVatReport(rows: VatReportRow[]): VatReportSummary {
  return rows.reduce<VatReportSummary>(
    (summary, row) => {
      const sign = row.type === 'credit_note' ? -1 : 1
      summary.net = round2(summary.net + sign * row.net)
      summary.vat = round2(summary.vat + sign * row.vat)
      summary.gross = round2(summary.gross + sign * row.gross)
      if (row.type === 'credit_note') summary.creditNotes += 1
      else summary.invoices += 1
      return summary
    },
    { net: 0, vat: 0, gross: 0, invoices: 0, creditNotes: 0 }
  )
}
