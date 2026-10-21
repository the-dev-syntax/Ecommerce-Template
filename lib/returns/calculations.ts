import type { TaxCategory } from '@/lib/tax'
import { round2 } from '@/lib/utils'

import {
  isFinalSaleOverrideReason,
  type RefundReason,
  type ReturnPolicy,
} from './policy'

export interface OrderItemForReturn {
  clientId: string
  product: string
  name: string
  price: number
  quantity: number
  netPrice?: number
  vatAmount?: number
  vatPercent?: number
  taxCategory?: TaxCategory
  exemptionReasonCode?: string
  variantId?: string
  sku?: string
  variantLabel?: string
  returnPolicy?: ReturnPolicy
  refundedQuantity?: number
  restockedQuantity?: number
}

export interface ReturnSelection {
  clientId: string
  quantity: number
}

export interface ReturnCalculationOptions {
  taxInclusive: boolean
  taxRate: number
}

export interface ReturnLine {
  clientId: string
  product: string
  name: string
  quantity: number
  returnPolicy: ReturnPolicy
  taxCategory: TaxCategory
  exemptionReasonCode: string
  variantId?: string
  sku?: string
  variantLabel?: string
  vatPercent: number
  unitNetPrice: number
  netAmount: number
  vatAmount: number
  grossAmount: number
}

export interface CreditNoteLine {
  clientId: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  taxCategory: TaxCategory
  exemptionReasonCode: string
  vatPercent: number
  vatAmount: number
}

export function getRemainingQuantity(item: OrderItemForReturn) {
  return Math.max(0, item.quantity - (item.refundedQuantity ?? 0))
}

function buildLine(
  item: OrderItemForReturn,
  quantity: number,
  options: ReturnCalculationOptions
): ReturnLine {
  const taxCategory = item.taxCategory ?? 'S'
  const rate =
    item.vatPercent !== undefined ? item.vatPercent / 100 : options.taxRate
  const unitNetPrice =
    item.netPrice ??
    (options.taxInclusive && taxCategory === 'S'
      ? round2(item.price / (1 + rate))
      : round2(item.price))
  const unitVat =
    item.vatAmount !== undefined && item.quantity > 0
      ? item.vatAmount / item.quantity
      : taxCategory === 'S'
        ? options.taxInclusive
          ? round2(item.price - unitNetPrice)
          : round2(unitNetPrice * rate)
        : 0

  const netAmount = round2(unitNetPrice * quantity)
  const vatAmount = round2(unitVat * quantity)

  return {
    clientId: item.clientId,
    product: item.product,
    name: item.name,
    quantity,
    returnPolicy: item.returnPolicy ?? 'return_and_refund',
    taxCategory,
    exemptionReasonCode: item.exemptionReasonCode ?? '',
    variantId: item.variantId,
    sku: item.sku,
    variantLabel: item.variantLabel,
    vatPercent: taxCategory === 'S' ? round2(rate * 100) : 0,
    unitNetPrice,
    netAmount,
    vatAmount,
    grossAmount: round2(netAmount + vatAmount),
  }
}

/**
 * Validate the admin's item selection and calculate the refundable amounts.
 * Prices come from the order snapshot, never from the browser.
 */
export function calculateReturnLines(
  items: OrderItemForReturn[],
  selections: ReturnSelection[],
  reason: RefundReason,
  options: ReturnCalculationOptions
): ReturnLine[] {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('Select at least one item to refund')
  }

  const itemsByClientId = new Map(items.map((item) => [item.clientId, item]))
  const seen = new Set<string>()

  return selections.map((selection) => {
    const item = itemsByClientId.get(selection.clientId)
    if (!item) throw new Error('Selected item is not part of this order')
    if (seen.has(selection.clientId)) {
      throw new Error(`Duplicate selection for ${item.name}`)
    }
    seen.add(selection.clientId)

    const quantity = Number(selection.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Invalid quantity for ${item.name}`)
    }

    const remaining = getRemainingQuantity(item)
    if (quantity > remaining) {
      throw new Error(
        `Only ${remaining} of ${item.name} can still be refunded`
      )
    }

    const policy = item.returnPolicy ?? 'return_and_refund'
    if (policy === 'final_sale' && !isFinalSaleOverrideReason(reason)) {
      throw new Error(
        `${item.name} is final sale and can only be refunded for a defective or wrong item`
      )
    }

    return buildLine(item, quantity, options)
  })
}

/**
 * Cancellation is a seller-side path: every remaining item is refunded
 * regardless of its return policy.
 */
export function calculateCancellationLines(
  items: OrderItemForReturn[],
  options: ReturnCalculationOptions
): ReturnLine[] {
  return items
    .map((item) => ({
      item,
      quantity: getRemainingQuantity(item),
    }))
    .filter(({ quantity }) => quantity > 0)
    .map(({ item, quantity }) => buildLine(item, quantity, options))
}

export function getShippingRefundAmount(
  shippingPrice: number,
  reason: RefundReason,
  shippingAlreadyRefunded: boolean
) {
  if (shippingAlreadyRefunded || shippingPrice <= 0) return 0
  return reason === 'defective' || reason === 'wrong_item'
    ? round2(shippingPrice)
    : 0
}

export function toCreditNoteLines(lines: ReturnLine[]): CreditNoteLine[] {
  return lines.map((line) => ({
    clientId: line.clientId,
    name: `Refund - ${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ''}`,
    quantity: line.quantity,
    unitPrice: line.unitNetPrice,
    lineTotal: line.netAmount,
    taxCategory: line.taxCategory,
    exemptionReasonCode: line.exemptionReasonCode,
    vatPercent: line.vatPercent,
    vatAmount: line.vatAmount,
  }))
}
