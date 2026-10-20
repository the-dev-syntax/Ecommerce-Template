import { getTranslations } from 'next-intl/server'

import ActionButton from '@/components/shared/action-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getInvoiceForOrder } from '@/lib/invoices/invoice'
import { retryZatcaInvoice } from '@/lib/actions/zatca.actions'
import { getZatcaSubmission } from '@/lib/zatca/service'
import { formatDateTime } from '@/lib/utils'

export default async function ZatcaStatusPanel({
  orderId,
}: {
  orderId: string
}) {
  const t = await getTranslations()
  const invoice = await getInvoiceForOrder(orderId, 'invoice')
  if (!invoice) return null

  const submission = await getZatcaSubmission(invoice._id)
  const creditNote = await getInvoiceForOrder(orderId, 'credit_note')
  const creditSubmission = creditNote
    ? await getZatcaSubmission(creditNote._id)
    : null
  const status = submission?.status ?? 'queued'
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
          <span>{t('Status')}:</span>
          <Badge
            variant={
              status === 'accepted'
                ? 'default'
                : status === 'failed' || status === 'rejected'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {t(status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : status === 'failed' ? 'Failed' : status === 'pending' ? 'Pending' : 'Queued')}
          </Badge>
          {submission?.icv && (
            <span>
              {t('ICV')}: {submission.icv}
            </span>
          )}
        </div>

        {submission?.invoiceHash && (
          <p className='break-all text-muted-foreground text-xs'>
            {t('Invoice Hash')}: {submission.invoiceHash}
          </p>
        )}

        {submission?.reportedAt && (
          <p className='text-muted-foreground text-xs'>
            {t('Reported At')}: {formatDateTime(submission.reportedAt).dateTime}
          </p>
        )}

        {submission?.zatcaWarnings?.slice(0, 3).map((warning, index) => (
          <p key={`warning-${index}`} className='text-amber-600 text-xs'>
            {t('Warning')}: {messageOf(warning)}
          </p>
        ))}

        {submission?.zatcaErrors?.slice(0, 3).map((error, index) => (
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

        {creditNote && (
          <div className='space-y-2 border-t pt-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <span>{t('Credit Note')}:</span>
              <Badge
                variant={
                  creditSubmission?.status === 'accepted'
                    ? 'default'
                    : creditSubmission?.status === 'failed' ||
                        creditSubmission?.status === 'rejected'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {t(
                  creditSubmission?.status === 'accepted'
                    ? 'Accepted'
                    : creditSubmission?.status === 'rejected'
                      ? 'Rejected'
                      : creditSubmission?.status === 'failed'
                        ? 'Failed'
                        : creditSubmission?.status === 'pending'
                          ? 'Pending'
                          : 'Queued'
                )}
              </Badge>
              {creditSubmission?.icv && (
                <span>
                  {t('ICV')}: {creditSubmission.icv}
                </span>
              )}
            </div>
            {creditSubmission?.zatcaWarnings?.slice(0, 2).map((warning, index) => (
              <p key={`cn-warning-${index}`} className='text-amber-600 text-xs'>
                {t('Warning')}: {messageOf(warning)}
              </p>
            ))}
            {creditSubmission?.zatcaErrors?.slice(0, 2).map((error, index) => (
              <p key={`cn-error-${index}`} className='text-destructive text-xs'>
                {t('Error')}: {messageOf(error)}
              </p>
            ))}
            {creditSubmission?.status !== 'accepted' && (
              <ActionButton
                caption={t('Retry ZATCA')}
                action={() => retryZatcaInvoice(creditNote._id)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

