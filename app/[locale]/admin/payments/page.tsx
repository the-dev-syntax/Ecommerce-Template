import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getSetting } from '@/lib/actions/setting.actions'
import { paymentProviders } from '@/lib/payments'
import PaymentEvent from '@/lib/db/models/payment-event.model'
import { connectToDatabase } from '@/lib/db'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PaymentsAdminPage() {
  const t = await getTranslations()
  const { availablePaymentMethods } = await getSetting()
  await connectToDatabase()
  const events = await PaymentEvent.find().sort({ receivedAt: -1 }).limit(30).lean()

  return (
    <main className='space-y-4 p-4'>
      <div>
        <h1 className='h1-bold'>{t('Payment Providers')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('Provider status is driven by environment configuration and store settings')}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {paymentProviders.map((provider) => {
          const enabled = availablePaymentMethods.some(
            (method) =>
              method.name.toLowerCase() === provider.name.toLowerCase()
          )
          const configured = provider.isConfigured()
          return (
            <Card key={provider.id}>
              <CardHeader className='flex flex-row items-center justify-between'>
                <CardTitle>{provider.label}</CardTitle>
                <Badge
                  variant={
                    configured && enabled
                      ? 'default'
                      : configured
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {configured ? t('Configured') : t('Not configured')}
                </Badge>
              </CardHeader>
              <CardContent className='space-y-1 text-sm'>
                <p>
                  {t('Enabled in checkout')}:{' '}
                  {enabled ? t('Yes') : t('No')}
                </p>
                <p>
                  {t('Refunds')}: {provider.supportsRefunds ? t('Yes') : t('No')}
                </p>
                <p>
                  {t('Currencies')}:{' '}
                  {provider.currencies === '*'
                    ? t('All')
                    : provider.currencies.join(', ')}
                </p>
                {provider.webhookPath && (
                  <p className='break-all text-muted-foreground text-xs'>
                    {t('Webhook')}: {provider.webhookPath}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Recent webhook events')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Provider')}</TableHead>
                <TableHead>{t('Type')}</TableHead>
                <TableHead>{t('Order')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Received')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={String(event._id)}>
                  <TableCell>{event.provider}</TableCell>
                  <TableCell>{event.type}</TableCell>
                  <TableCell>{event.orderId || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.status === 'failed'
                          ? 'destructive'
                          : event.status === 'processed'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(event.receivedAt).dateTime}
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className='text-center'>
                    {t('No webhook events yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
