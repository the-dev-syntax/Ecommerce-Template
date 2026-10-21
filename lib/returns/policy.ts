export const RETURN_POLICIES = [
  'return_and_refund',
  'refund_only',
  'final_sale',
] as const

export type ReturnPolicy = (typeof RETURN_POLICIES)[number]

export const REFUND_REASONS = [
  'customer_return',
  'defective',
  'wrong_item',
  'other',
] as const

export type RefundReason = (typeof REFUND_REASONS)[number]

/** Reasons that override a final-sale policy (seller-fault returns). */
export const FINAL_SALE_OVERRIDE_REASONS: RefundReason[] = [
  'defective',
  'wrong_item',
]

export function isFinalSaleOverrideReason(reason: RefundReason) {
  return FINAL_SALE_OVERRIDE_REASONS.includes(reason)
}

/** Defective/wrong-item returns are seller-fault, so shipping is refunded. */
export function refundsShipping(reason: RefundReason) {
  return isFinalSaleOverrideReason(reason)
}

export function policyAllowsRefund(policy: ReturnPolicy | undefined) {
  return (policy ?? 'return_and_refund') !== 'final_sale'
}

export function policyAllowsReturn(policy: ReturnPolicy | undefined) {
  return (policy ?? 'return_and_refund') === 'return_and_refund'
}
