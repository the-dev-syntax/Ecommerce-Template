import { round2 } from '@/lib/utils'

import type { TaxCategory } from '@/lib/tax'

export interface CreditNoteSourceLine {
  name: string
  /** VAT-exclusive line amount from the original invoice. */
  lineTotal: number
  vatAmount: number
  taxCategory: TaxCategory
  exemptionReasonCode?: string
  vatPercent: number
}

export interface CreditNoteLine {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  taxCategory: TaxCategory
  exemptionReasonCode: string
  vatPercent: number
  vatAmount: number
}

/**
 * Allocate a gross refund across the original invoice lines.
 *
 * The refund is split by each line's gross share (net + VAT) using integer
 * cents and the largest-remainder method, so the credit note total always
 * equals the refunded amount and no line can end up negative. Non-taxable
 * lines (shipping, Z/E/O products) keep their zero VAT.
 */
export function allocateRefundToLines(
  lines: CreditNoteSourceLine[],
  refund: number,
  originalTotal: number
): CreditNoteLine[] {
  if (!Number.isFinite(refund) || refund <= 0) {
    throw new Error('A credit note requires a refunded amount')
  }
  if (!Number.isFinite(originalTotal) || originalTotal <= 0) {
    throw new Error('Original invoice has no total')
  }

  const grossLines = lines.map((line) =>
    round2(Math.max(0, line.lineTotal) + Math.max(0, line.vatAmount))
  )
  const grossTotal = round2(
    grossLines.reduce((total, gross) => total + gross, 0)
  )
  if (grossTotal <= 0) throw new Error('Original invoice has no total')

  const refundCents = Math.min(
    Math.round(refund * 100),
    Math.round(originalTotal * 100)
  )
  const exactCents = grossLines.map(
    (gross) => (refundCents * gross) / grossTotal
  )
  const allocatedCents = exactCents.map((cents) => Math.floor(cents))
  const remainder = refundCents - allocatedCents.reduce((a, b) => a + b, 0)

  const byRemainder = exactCents
    .map((cents, index) => ({ index, fraction: cents - Math.floor(cents) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (let index = 0; index < remainder; index++) {
    allocatedCents[byRemainder[index % byRemainder.length].index] += 1
  }

  return lines
    .map((line, index) => {
      const grossShare = allocatedCents[index] / 100
      const lineGross = grossLines[index]

      if (grossShare <= 0 || lineGross <= 0) {
        return null
      }

      const vatAmount =
        line.taxCategory === 'S'
          ? round2((grossShare * line.vatAmount) / lineGross)
          : 0
      const lineTotal = round2(grossShare - vatAmount)

      return {
        name: `Refund - ${line.name}`,
        quantity: 1,
        unitPrice: lineTotal,
        lineTotal,
        taxCategory: line.taxCategory,
        exemptionReasonCode: line.exemptionReasonCode ?? '',
        vatPercent: line.taxCategory === 'S' ? line.vatPercent : 0,
        vatAmount,
      }
    })
    .filter((line): line is CreditNoteLine => line !== null)
}
