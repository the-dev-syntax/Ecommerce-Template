'use client'

import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { IOrder } from '@/lib/db/models/order.model'
import { formatCurrency } from '@/lib/utils'
import { cancelOrder, refundMoyasarOrder } from '@/lib/actions/order.actions'

export default function RefundOrderForm({ order }: { order: IOrder }) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const refundedAmount = order.refundedAmount ?? 0
  const remaining = Math.max(0, order.totalPrice - refundedAmount)
  const canRefund =
    order.isPaid &&
    !order.isCancelled &&
    order.paymentMethod === 'Moyasar' &&
    remaining > 0 &&
    refundedAmount === 0
  const canCancel =
    !order.isDelivered &&
    !order.isCancelled &&
    (order.paymentMethod === 'Moyasar' ||
      order.paymentMethod === 'Cash On Delivery' ||
      !order.isPaid) &&
    (remaining === 0 || refundedAmount === 0)
  const partiallyRefunded = refundedAmount > 0 && remaining > 0

  if (!canRefund && !canCancel && !partiallyRefunded) return null

  const handleRefund = async () => {
    const parsed = amount.trim() ? Number(amount) : undefined

    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast({ description: 'Enter a valid refund amount', variant: 'destructive' })
      return
    }

    setIsRefunding(true)
    const res = await refundMoyasarOrder(order._id, parsed)
    setIsRefunding(false)

    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })

    if (res.success) {
      setAmount('')
      router.refresh()
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    const res = await cancelOrder(order._id, reason)
    setIsCancelling(false)

    toast({
      description: res.message,
      variant: res.success ? 'default' : 'destructive',
    })

    if (res.success) {
      setCancelOpen(false)
      setReason('')
      router.refresh()
    }
  }

  return (
    <div className='space-y-4 border-t pt-4'>
      {canRefund && (
        <>
          <div>
            <h3 className='font-bold'>{t('Refund order')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Refunded amount')}:{' '}
              {formatCurrency(refundedAmount, order.currency)}
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='refund-amount'>{t('Refund amount')}</Label>
            <Input
              id='refund-amount'
              type='number'
              min='0.01'
              step='0.01'
              max={remaining}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={remaining.toFixed(2)}
            />
            <p className='text-muted-foreground text-xs'>
              {t('RefundRemainingHint')}
            </p>
          </div>

          <Button
            type='button'
            className='w-full rounded-full'
            disabled={isRefunding}
            onClick={handleRefund}
          >
            {isRefunding ? t('Processing') : t('Refund')}
          </Button>
        </>
      )}

      {partiallyRefunded && (
        <p className='text-muted-foreground text-sm'>
          {t('PartialRefundNote')}
        </p>
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
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <Button
                type='button'
                variant='destructive'
                disabled={isCancelling}
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
