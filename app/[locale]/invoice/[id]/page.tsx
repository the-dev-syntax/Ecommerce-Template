import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { getTranslations } from 'next-intl/server'

import PrintButton from '@/components/shared/invoice/print-button'
import { getOrderById } from '@/lib/actions/order.actions'
import {
  getOrCreateCreditNoteForOrder,
  getOrCreateInvoiceForOrder,
} from '@/lib/invoices/invoice'
import { formatCurrency } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations()
  return { title: t('Tax Invoice') }
}

export default async function InvoicePage(props: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await props.params
  const t = await getTranslations()

  const order = await getOrderById(id)
  if (!order || !order.isPaid) notFound()

  const invoice = await getOrCreateInvoiceForOrder(id, 'invoice')
  const creditNote = await getOrCreateCreditNoteForOrder(id)
  const isRtl = locale.startsWith('ar')

  const invoiceQr = await QRCode.toDataURL(invoice.qrPayload, {
    margin: 1,
    width: 220,
  })
  const creditQr = creditNote
    ? await QRCode.toDataURL(creditNote.qrPayload, { margin: 1, width: 220 })
    : null

  const money = (amount: number) =>
    formatCurrency(amount, invoice.currency, locale)
  const date = (value: Date | string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(value))

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className='mx-auto max-w-4xl space-y-8 p-4 print:max-w-none print:p-0'
    >
      <div className='flex items-center justify-between print:hidden'>
        <h1 className='h1-bold'>{t('Tax Invoice')}</h1>
        <PrintButton />
      </div>

      <section className='space-y-6 rounded-lg border p-6 print:border-0'>
        <header className='flex flex-col justify-between gap-4 border-b pb-4 md:flex-row'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold'>
              {isRtl
                ? invoice.seller.legalNameAr
                : invoice.seller.legalNameEn}
            </h2>
            <p className='text-sm text-muted-foreground'>
              {invoice.seller.legalNameEn}
            </p>
            <p className='text-sm'>{invoice.seller.legalNameAr}</p>
            <p className='text-sm'>
              {t('VAT Number')}: {invoice.seller.vatNumber}
            </p>
            {invoice.seller.crNumber && (
              <p className='text-sm'>
                {t('CR Number')}: {invoice.seller.crNumber}
              </p>
            )}
            {invoice.seller.nationalAddress && (
              <p className='text-sm'>{invoice.seller.nationalAddress}</p>
            )}
            <p className='text-sm'>
              {invoice.seller.email} {invoice.seller.phone}
            </p>
          </div>
          <div className='space-y-1 md:text-end'>
            <h3 className='text-lg font-semibold'>{t('Tax Invoice')}</h3>
            <p className='text-sm'>
              {t('Invoice Number')}: <strong>{invoice.number}</strong>
            </p>
            <p className='text-sm'>
              {t('Invoice Date')}: {date(invoice.issuedAt)}
            </p>
          </div>
        </header>

        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <h3 className='mb-1 font-semibold'>{t('Buyer')}</h3>
            <p>{invoice.buyer.name}</p>
            {invoice.buyer.address && <p>{invoice.buyer.address}</p>}
            {invoice.buyer.phone && <p>{invoice.buyer.phone}</p>}
            {invoice.buyer.email && <p>{invoice.buyer.email}</p>}
          </div>
          <div className='flex items-start justify-end'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={invoiceQr} alt={t('QR Code')} width={140} height={140} />
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='border-y bg-muted/50'>
              <tr>
                <th className='p-2 text-start'>{t('Description')}</th>
                <th className='p-2 text-end'>{t('Quantity')}</th>
                <th className='p-2 text-end'>{t('Unit Price')}</th>
                <th className='p-2 text-end'>{t('Line Total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className='border-b'>
                  <td className='p-2'>{item.name}</td>
                  <td className='p-2 text-end'>{item.quantity}</td>
                  <td className='p-2 text-end'>{money(item.unitPrice)}</td>
                  <td className='p-2 text-end'>{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='ms-auto max-w-sm space-y-1 text-sm'>
          <div className='flex justify-between'>
            <span>{t('Subtotal')}</span>
            <span>{money(invoice.itemsPrice)}</span>
          </div>
          {invoice.shippingPrice > 0 && (
            <div className='flex justify-between'>
              <span>{t('Shipping')}</span>
              <span>{money(invoice.shippingPrice)}</span>
            </div>
          )}
          <div className='flex justify-between'>
            <span>{t('VAT')}</span>
            <span>{money(invoice.vatAmount)}</span>
          </div>
          <div className='flex justify-between border-t pt-1 text-base font-bold'>
            <span>{t('Total')}</span>
            <span>{money(invoice.total)}</span>
          </div>
        </div>

        <p className='text-xs text-muted-foreground'>{t('QrCodeNote')}</p>
      </section>

      {creditNote && creditQr && (
        <section className='space-y-4 rounded-lg border p-6 print:border-0'>
          <header className='flex flex-col justify-between gap-4 border-b pb-4 md:flex-row'>
            <div>
              <h2 className='text-xl font-bold'>{t('Credit Note')}</h2>
              <p className='text-sm'>
                {t('Original Invoice')}: {creditNote.originalInvoiceNumber}
              </p>
            </div>
            <div className='md:text-end'>
              <p className='text-sm'>
                {t('Invoice Number')}: <strong>{creditNote.number}</strong>
              </p>
              <p className='text-sm'>
                {t('Invoice Date')}: {date(creditNote.issuedAt)}
              </p>
            </div>
          </header>

          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-1 text-sm'>
              <div className='flex justify-between gap-8'>
                <span>{t('Refunded Amount')}</span>
                <span>{money(creditNote.itemsPrice)}</span>
              </div>
              <div className='flex justify-between gap-8'>
                <span>{t('VAT')}</span>
                <span>{money(creditNote.vatAmount)}</span>
              </div>
              <div className='flex justify-between gap-8 border-t pt-1 text-base font-bold'>
                <span>{t('Total')}</span>
                <span>{money(creditNote.total)}</span>
              </div>
              {creditNote.notes && (
                <p className='text-muted-foreground'>{creditNote.notes}</p>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={creditQr} alt={t('QR Code')} width={140} height={140} />
          </div>
        </section>
      )}

      <p className='text-center text-xs text-muted-foreground'>
        {t('InvoiceFooter')}
      </p>
    </main>
  )
}
