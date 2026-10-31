/**
 * True when the gateway has already refunded at least the amount this request
 * needs, even if the local transaction never ran. Used to reconcile a retry
 * after a crash between the gateway call and the database transaction.
 */
export function gatewayRefundCoversRequest(input: {
  gatewayRefunded: number
  recordedRefunded: number
  requested: number
}): boolean {
  return (
    input.gatewayRefunded >=
    input.recordedRefunded + input.requested - 0.01
  )
}
