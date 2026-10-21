'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { IOrder } from '@/lib/db/models/order.model'
import {
  calculateReturnLines,
  getRemainingQuantity,
  getShippingRefundAmount,
  type ReturnSelection,
} from '@/lib/returns/calculations'
import {
  isFinalSaleOverrideReason,
  type RefundReason,
  type ReturnPolicy,
} from '@/lib/returns/policy'
import { formatCurrency, round2 } from '@/lib/utils'
import { cancelOrder, refundOrderItems } from '@/lib/actions/order.actions'

const REASONS: RefundReason[] = [
  'customer_return',
  'defective',
  'wrong_item',
  'other',
]

export default function RefundOrderForm({ order }: { order: IOrder }) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<RefundReason>('customer_return')
  const [overrideReason, setOverrideReason] = useState('')
  const [manualReference, setManualReference] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  )
  const [cancelReason, setCancelReason] = useState('')
  const [cancelReference, setCancelReference] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const refundedAmount = order.refundedAmount ?? 0
  const remainingPayment = Math.max(0, order.totalPrice - refundedAmount)
  const items = useMemo(() => order.items ?? [], [order.items])
  const hasRemainingItems = items.some(
    (item) => getRemainingQuantity(item) > 0
  )
  const canReturn =
    order.isPaid &&
    order.isDelivered &&
    !order.isCancelled &&
    hasRemainingItems
  const canCancel =
    !order.isDelivered &&
    !order.isCancelled &&
    order.shipment?.status !== 'in_transit' &&
    (remainingPayment === 0 || refundedAmount === 0)
  const isManualRefund =
    order.paymentMethod !== 'Moyasar' || refundedAmount > 0

  const selections = useMemo<ReturnSelection[]>(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([clientId, quantity]) => ({ clientId, quantity })),
    [quantities]
  )

  const preview = useMemo(() => {
    if (selections.length === 0) {
      return {
        lines: [],
        shipping: 0,
        total: 0,
        error: '',
        needsOverride: false,
      }
    }

    try {
      const lines = calculateReturnLines(items, selections, reason, {
        taxInclusive: order.taxInclusive ?? true,
        taxRate: order.taxRate ?? 0.15,
      })
      const shippingAmount = getShippingRefundAmount(
        round2(order.shippingPrice + (order.codFee ?? 0)),
        reason,
        order.shippingRefunded ?? false
      )
      return {
        lines,
        shipping: shippingAmount,
        total: round2(
          lines.reduce((sum, line) => sum + line.grossAmount, 0) +
            shippingAmount
        ),
        error: '',
        needsOverride: lines.some(
          (line) => line.returnPolicy === 'final_sale'
        ),
      }
    } catch (error) {
      return {
        lines: [],
        shipping: 0,
        total: 0,
        error: error instanceof Error ? error.message : String(error),
        needsOverride: false,
      }
    }
  }, [items, order, reason, selections])

  const overrideRequired = preview.needsOverride
  const canSubmit =
    canReturn &&
    selections.length > 0 &&
    !preview.error &&
    preview.total > 0 &&
    (!overrideRequired || overrideReason.trim().length > 0) &&
    (!isManualRefund || manualReference.trim().length > 0) &&
    !isRefunding

  if (!canReturn && !canCancel) return null

  const policyLabel = (policy: ReturnPolicy) =>
    policy === 'final_sale'
      ? t('Final sale')
      : policy === 'refund_only'
        ? t('Refund only')
        : t('Return and refund')

  const handleRefund = async () => {
    setIsRefunding(true)
    const res = await refundOrderItems({
      orderId: order._id,
      selections,
      reason,
      policyOverrideReason: overrideReason.trim() || undefined,
      manualReference: manualReference.trim() || undefined,
      idempotencyKey,
    })
    setIsRefunding(false)

    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })

    if (res.success) {
      setQuantities({})
      setReason('customer_return')
      setOverrideReason('')
      setManualReference('')
      setIdempotencyKey(crypto.randomUUID())
      router.refresh()
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    const res = await cancelOrder(
      order._id,
      cancelReason,
      cancelReference.trim() || undefined
    )
    setIsCancelling(false)

    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })

    if (res.success) {
      setCancelOpen(false)
      setCancelReason('')
      setCancelReference('')
      router.refresh()
    }
  }

  return (
    <div className='space-y-4 border-t pt-4'>
      {canReturn && (
        <div className='space-y-4'>
          <div>
            <h3 className='font-bold'>{t('Return and refund')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Select the items being returned or refunded')}
            </p>
            <p className='text-muted-foreground text-xs'>
              {t('Shipping is non-refundable for change-of-mind returns')}
            </p>
          </div>

          <div className='space-y-3'>
            {items.map((item) => {
              const remaining = getRemainingQuantity(item)
              const policy = item.returnPolicy ?? 'return_and_refund'
              return (
                <div
                  key={item.clientId}
                  className='rounded-md border p-3 text-sm'
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='font-medium'>{item.name}</div>
                    <Badge
                      variant={
                        policy === 'final_sale'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {policyLabel(policy)}
                    </Badge>
                  </div>
                  <div className='text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                    <span>
                      {t('Purchased')}: {item.quantity}
                    </span>
                    <span>
                      {t('Already refunded')}: {item.refundedQuantity ?? 0}
                    </span>
                    <span>
                      {t('Remaining')}: {remaining}
                    </span>
                    <span>
                      {formatCurrency(item.price, order.currency)}
                    </span>
                  </div>
                  {remaining > 0 ? (
                    <div className='mt-2 flex items-center gap-2'>
                      <Label
                        htmlFor={`return-${item.clientId}`}
                        className='text-xs'
                      >
                        {t('Quantity')}
                      </Label>
                      <Input
                        id={`return-${item.clientId}`}
                        type='number'
                        min={0}
                        max={remaining}
                        step={1}
                        value={quantities[item.clientId] ?? 0}
                        onChange={(event) => {
                          const value = Math.max(
                            0,
                            Math.min(remaining, Number(event.target.value) || 0)
                          )
                          setQuantities((current) => ({
                            ...current,
                            [item.clientId]: Math.floor(value),
                          }))
                        }}
                        className='h-8 w-20'
                      />
                    </div>
                  ) : (
                    <p className='text-muted-foreground mt-2 text-xs'>
                      {t('This item has already been refunded')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className='space-y-2'>
            <Label>{t('Return reason')}</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as RefundReason)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'customer_return'
                      ? t('Customer return')
                      : value === 'defective'
                        ? t('Defective item')
                        : value === 'wrong_item'
                          ? t('Wrong item')
                          : t('Other')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isFinalSaleOverrideReason(reason) && (
            <p className='text-muted-foreground text-xs'>
              {t('Shipping will be refunded for defective or wrong items')}
            </p>
          )}

          {overrideRequired && (
            <div className='space-y-2'>
              <Label htmlFor='override-reason'>
                {t('Override reason')}
              </Label>
              <Input
                id='override-reason'
                value={overrideReason}
                maxLength={500}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                {t('A reason is required when refunding a final-sale item')}
              </p>
            </div>
          )}

          {isManualRefund && (
            <div className='space-y-2'>
              <Label htmlFor='manual-reference'>
                {t('Manual refund reference')}
              </Label>
              <Input
                id='manual-reference'
                value={manualReference}
                maxLength={200}
                onChange={(event) => setManualReference(event.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                {order.paymentMethod === 'Moyasar' && refundedAmount > 0
                  ? t(
                      'Moyasar cannot refund this payment again; record the refund manually'
                    )
                  : t('Record the refund reference after returning the money')}
              </p>
            </div>
          )}

          {selections.length > 0 && (
            <div className='space-y-1 rounded-md bg-muted/50 p-3 text-sm'>
              <div className='flex justify-between'>
                <span>{t('Items refund')}</span>
                <span>
                  {formatCurrency(
                    round2(
                      preview.lines.reduce(
                        (sum, line) => sum + line.grossAmount,
                        0
                      )
                    ),
                    order.currency
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span>{t('Shipping refund')}</span>
                <span>{formatCurrency(preview.shipping, order.currency)}</span>
              </div>
              <div className='flex justify-between border-t pt-1 font-bold'>
                <span>{t('Total refund')}</span>
                <span>{formatCurrency(preview.total, order.currency)}</span>
              </div>
              {preview.error && (
                <p className='text-destructive text-xs'>{preview.error}</p>
              )}
            </div>
          )}

          <Button
            type='button'
            className='w-full rounded-full'
            disabled={!canSubmit}
            onClick={handleRefund}
          >
            {isRefunding ? t('Processing') : t('Process refund')}
          </Button>
        </div>
      )}

      {canCancel && (
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type='button'
              variant='destructive'
              className='w-full rounded-full'
            >
              {t('Cancel order')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Cancel order')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('CancelOrderDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='space-y-2'>
              <Label htmlFor='cancel-reason'>
                {t('Cancellation reason')} ({t('Optional')})
              </Label>
              <Input
                id='cancel-reason'
                value={cancelReason}
                maxLength={500}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </div>

            {order.isPaid && isManualRefund && (
              <div className='space-y-2'>
                <Label htmlFor='cancel-reference'>
                  {t('Manual refund reference')}
                </Label>
                <Input
                  id='cancel-reference'
                  value={cancelReference}
                  maxLength={200}
                  onChange={(event) =>
                    setCancelReference(event.target.value)
                  }
                />
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <Button
                type='button'
                variant='destructive'
                disabled={
                  isCancelling ||
                  (order.isPaid && isManualRefund && !cancelReference.trim())
                }
                onClick={handleCancel}
              >
                {isCancelling ? t('Processing') : t('ConfirmCancellation')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
