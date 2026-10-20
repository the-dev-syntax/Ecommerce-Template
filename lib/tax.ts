import { round2 } from '@/lib/utils'

export type TaxCategory = 'S' | 'Z' | 'E' | 'O'

export interface TaxableLine {
  price: number
  quantity: number
  taxCategory?: TaxCategory
}

export interface PricedLine {
  grossLineTotal: number
  netLineTotal: number
  vatAmount: number
  unitNetPrice: number
  vatPercent: number
}

/** KSA VAT is only applied to category S lines. Shipping is not taxable. */
export function priceLine(
  line: TaxableLine,
  taxRate: number,
  taxInclusive: boolean
): PricedLine {
  const category = line.taxCategory ?? 'S'
  const grossLineTotal = round2(line.price * line.quantity)

  if (category !== 'S' || taxRate <= 0) {
    return {
      grossLineTotal,
      netLineTotal: grossLineTotal,
      vatAmount: 0,
      unitNetPrice: round2(line.price),
      vatPercent: 0,
    }
  }

  if (!taxInclusive) {
    const netLineTotal = grossLineTotal
    const vatAmount = round2(netLineTotal * taxRate)
    return {
      grossLineTotal: round2(netLineTotal + vatAmount),
      netLineTotal,
      vatAmount,
      unitNetPrice: round2(line.price),
      vatPercent: round2(taxRate * 100),
    }
  }

  // Prices are gross. Derive the net unit price first so the printed invoice
  // line (quantity x unit price) and the ZATCA line amount agree.
  const unitNetPrice = round2(line.price / (1 + taxRate))
  const netLineTotal = round2(unitNetPrice * line.quantity)
  const vatAmount = round2(grossLineTotal - netLineTotal)

  return {
    grossLineTotal,
    netLineTotal,
    vatAmount,
    unitNetPrice,
    vatPercent: round2(taxRate * 100),
  }
}

export function priceOrderItems<T extends TaxableLine>(
  items: T[],
  taxRate: number,
  taxInclusive: boolean
) {
  return items.map((item) => {
    const priced = priceLine(item, taxRate, taxInclusive)
    return {
      ...item,
      taxCategory: item.taxCategory ?? 'S',
      netPrice: priced.unitNetPrice,
      vatAmount: priced.vatAmount,
      vatPercent: priced.vatPercent,
    }
  })
}
