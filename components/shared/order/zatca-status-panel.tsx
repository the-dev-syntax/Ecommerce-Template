import { getTranslations } from 'next-intl/server'

import ActionButton from '@/components/shared/action-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCreditNotesForOrder, getInvoiceForOrder } from '@/lib/invoices/invoice'
import { retryZatcaInvoice } from '@/lib/actions/zatca.actions'
import { getZatcaSubmission } from '@/lib/zatca/service'
import { formatDateTime } from '@/lib/utils'

function statusLabel(
  status: string | undefined,
  t: (key: string) => string
) {
  return status === 'accepted'
    ? t('Accepted')
    : status === 'rejected'
      ? t('Rejected')
      : status === 'failed'
        ? t('Failed')
        : status === 'pending'
          ? t('Pending')
          : t('Queued')
}

export default async function ZatcaStatusPanel({
  orderId,
}: {
  orderId: string
}) {
  const t = await getTranslations()
  const invoice = await getInvoiceForOrder(orderId, 'invoice')
  if (!invoice) return null

  const invoiceSubmission = await getZatcaSubmission(invoice._id)
  const creditNotes = await getCreditNotesForOrder(orderId)
  const creditEntries = await Promise.all(
    creditNotes.map(async (creditNote) => ({
      creditNote,
      submission: await getZatcaSubmission(creditNote._id),
    }))
  )
  const status = invoiceSubmission?.status ?? 'queued'
  const canRetry = status !== 'accepted'
  const messageOf = (value: unknown) =>
    value && typeof value === 'object' && 'message' in value
      ? String((value as { message?: unknown }).message ?? '')
      : String(value)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('ZATCA Status')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 text-sm'>
        <div className='flex flex-wrap items-center gap-2'>
          <span>{t('Tax Invoice')}:</span>
          <Badge
            variant={
              status === 'accepted'
                ? 'default'
                : status === 'failed' || status === 'rejected'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {statusLabel(status, t)}
          </Badge>
          {invoiceSubmission?.icv && (
            <span>
              {t('ICV')}: {invoiceSubmission.icv}
            </span>
          )}
        </div>

        {invoiceSubmission?.invoiceHash && (
          <p className='break-all text-muted-foreground text-xs'>
            {t('Invoice Hash')}: {invoiceSubmission.invoiceHash}
          </p>
        )}

        {invoiceSubmission?.reportedAt && (
          <p className='text-muted-foreground text-xs'>
            {t('Reported At')}:{' '}
            {formatDateTime(invoiceSubmission.reportedAt).dateTime}
          </p>
        )}

        {invoiceSubmission?.zatcaWarnings?.slice(0, 3).map((warning, index) => (
          <p key={`warning-${index}`} className='text-amber-600 text-xs'>
            {t('Warning')}: {messageOf(warning)}
          </p>
        ))}

        {invoiceSubmission?.zatcaErrors?.slice(0, 3).map((error, index) => (
          <p key={`error-${index}`} className='text-destructive text-xs'>
            {t('Error')}: {messageOf(error)}
          </p>
        ))}

        {canRetry && (
          <ActionButton
            caption={t('Retry ZATCA')}
            action={() => retryZatcaInvoice(invoice._id)}
          />
        )}

        {creditEntries.map(({ creditNote, submission }) => {
          const creditStatus = submission?.status ?? 'queued'
          return (
            <div
              key={creditNote._id}
              className='space-y-2 border-t pt-3'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <span>
                  {t('Credit Note')} {creditNote.number}:
                </span>
                <Badge
                  variant={
                    creditStatus === 'accepted'
                      ? 'default'
                      : creditStatus === 'failed' ||
                          creditStatus === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {statusLabel(creditStatus, t)}
                </Badge>
                {submission?.icv && (
                  <span>
                    {t('ICV')}: {submission.icv}
                  </span>
                )}
              </div>
              {submission?.zatcaWarnings?.slice(0, 2).map((warning, index) => (
                <p
                  key={`cn-warning-${index}`}
                  className='text-amber-600 text-xs'
                >
                  {t('Warning')}: {messageOf(warning)}
                </p>
              ))}
              {submission?.zatcaErrors?.slice(0, 2).map((error, index) => (
                <p
                  key={`cn-error-${index}`}
                  className='text-destructive text-xs'
                >
                  {t('Error')}: {messageOf(error)}
                </p>
              ))}
              {creditStatus !== 'accepted' && (
                <ActionButton
                  caption={t('Retry ZATCA')}
                  action={() => retryZatcaInvoice(creditNote._id)}
                />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
