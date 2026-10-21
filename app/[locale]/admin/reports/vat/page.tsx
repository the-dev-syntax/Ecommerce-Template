import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getVatReport } from '@/lib/reports/vat'
import { formatCurrency, formatDateTime, round2 } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function defaultDateRange() {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  }
}

export default async function VatReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const t = await getTranslations()
  const params = await props.searchParams
  const defaults = defaultDateRange()
  const from = params.from || defaults.from
  const to = params.to || defaults.to
  const { rows, summary } = await getVatReport({ from, to })
  const currency = rows[0]?.currency || 'SAR'
  const money = (value: number) => formatCurrency(value, currency)

  return (
    <main className='space-y-4 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='h1-bold'>{t('VAT Report')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Tax invoices and credit notes for the selected period')}
          </p>
        </div>
        <Button asChild variant='outline'>
          <Link
            href={`/api/admin/reports/vat?from=${from}&to=${to}`}
            prefetch={false}
          >
            {t('Export CSV')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className='p-4'>
          <form className='flex flex-wrap items-end gap-3'>
            <label className='space-y-1 text-sm'>
              <span>{t('From')}</span>
              <input
                type='date'
                name='from'
                defaultValue={from}
                className='block rounded-md border bg-background px-3 py-2'
              />
            </label>
            <label className='space-y-1 text-sm'>
              <span>{t('To')}</span>
              <input
                type='date'
                name='to'
                defaultValue={to}
                className='block rounded-md border bg-background px-3 py-2'
              />
            </label>
            <Button type='submit'>{t('Apply')}</Button>
          </form>
        </CardContent>
      </Card>

      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Net sales')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {money(summary.net)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('VAT')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {money(summary.vat)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Gross')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {money(summary.gross)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>{t('Documents')}</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {summary.invoices + summary.creditNotes}
            <span className='text-muted-foreground block text-xs font-normal'>
              {summary.invoices} {t('invoices')} / {summary.creditNotes}{' '}
              {t('credit notes')}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Invoices')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Invoice Number')}</TableHead>
                <TableHead>{t('Type')}</TableHead>
                <TableHead>{t('Date')}</TableHead>
                <TableHead>{t('Order')}</TableHead>
                <TableHead className='text-end'>{t('Net')}</TableHead>
                <TableHead className='text-end'>{t('VAT')}</TableHead>
                <TableHead className='text-end'>{t('Gross')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const sign = row.type === 'credit_note' ? -1 : 1
                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.number}</TableCell>
                    <TableCell>
                      {row.type === 'credit_note'
                        ? row.reason === 'cancellation'
                          ? t('Cancellation')
                          : t('Credit Note')
                        : t('Tax Invoice')}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(row.issuedAt).dateTime}
                    </TableCell>
                    <TableCell>{row.orderId}</TableCell>
                    <TableCell className='text-end'>
                      {money(round2(sign * row.net))}
                    </TableCell>
                    <TableCell className='text-end'>
                      {money(round2(sign * row.vat))}
                    </TableCell>
                    <TableCell className='text-end'>
                      {money(round2(sign * row.gross))}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className='text-center'>
                    {t('No invoices in this period')}
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
