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
import Order from '@/lib/db/models/order.model'
import { connectToDatabase } from '@/lib/db'
import { formatCurrency, formatDateTime, round2 } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PaymentsAdminPage() {
  const t = await getTranslations()
  const { availablePaymentMethods, availableCurrencies, defaultCurrency } =
    await getSetting()
  await connectToDatabase()
  const events = await PaymentEvent.find().sort({ receivedAt: -1 }).limit(30).lean()
  const orders = await Order.find({ isPaid: true })
    .select('paymentMethod totalPrice refundedAmount isDisputed')
    .lean()
  const totals = orders.reduce(
    (summary, order) => {
      const provider = order.paymentMethod || 'Unknown'
      const current = summary.byProvider.get(provider) ?? {
        count: 0,
        gross: 0,
        refunded: 0,
      }
      current.count += 1
      current.gross = round2(current.gross + order.totalPrice)
      current.refunded = round2(
        current.refunded + (order.refundedAmount ?? 0)
      )
      summary.byProvider.set(provider, current)
      summary.gross = round2(summary.gross + order.totalPrice)
      summary.refunded = round2(
        summary.refunded + (order.refundedAmount ?? 0)
      )
      if (order.isDisputed) summary.disputes += 1
      return summary
    },
    {
      gross: 0,
      refunded: 0,
      disputes: 0,
      byProvider: new Map<
        string,
        { count: number; gross: number; refunded: number }
      >(),
    }
  )
  const currency =
    availableCurrencies.find((item) => item.isBase)?.code ??
    defaultCurrency ??
    'SAR'

  return (
    <main className='space-y-4 p-4'>
      <div>
        <h1 className='h1-bold'>{t('Payment Providers')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('Provider status is driven by environment configuration and store settings')}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Gross collected')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {formatCurrency(totals.gross, currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Refunded')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {formatCurrency(totals.refunded, currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Net collected')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {formatCurrency(totals.gross - totals.refunded, currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Disputed orders')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {totals.disputes}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Reconciliation by provider')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Provider')}</TableHead>
                <TableHead className='text-end'>{t('Orders')}</TableHead>
                <TableHead className='text-end'>{t('Gross')}</TableHead>
                <TableHead className='text-end'>{t('Refunded')}</TableHead>
                <TableHead className='text-end'>{t('Net')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(totals.byProvider.entries()).map(
                ([provider, values]) => (
                  <TableRow key={provider}>
                    <TableCell>{provider}</TableCell>
                    <TableCell className='text-end'>{values.count}</TableCell>
                    <TableCell className='text-end'>
                      {formatCurrency(values.gross, currency)}
                    </TableCell>
                    <TableCell className='text-end'>
                      {formatCurrency(values.refunded, currency)}
                    </TableCell>
                    <TableCell className='text-end'>
                      {formatCurrency(
                        values.gross - values.refunded,
                        currency
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                {provider.unifiedWebhookPath && (
                  <p className='break-all text-muted-foreground text-xs'>
                    {t('Unified webhook')}: {provider.unifiedWebhookPath}
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
