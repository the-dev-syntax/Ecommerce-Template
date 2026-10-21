import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { getTranslations } from 'next-intl/server'

import PrintButton from '@/components/shared/invoice/print-button'
import { Button } from '@/components/ui/button'
import { getOrderById } from '@/lib/actions/order.actions'
import {
  getCreditNotesForOrder,
  getOrCreateCreditNoteForOrder,
  getOrCreateInvoiceForOrder,
} from '@/lib/invoices/invoice'
import { getZatcaSubmission, queueZatcaForInvoice } from '@/lib/zatca/service'
import { formatCurrency } from '@/lib/utils'

export async function generateMetadata() {
  const t = await getTranslations({ locale: 'ar' })
  return { title: t('Tax Invoice') }
}

export default async function InvoicePage(props: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { locale, id } = await props.params
  const { lang } = await props.searchParams
  // The printed invoice defaults to Arabic; ?lang=en switches the display.
  const invoiceLocale = lang === 'en' ? 'en-US' : 'ar'
  const isRtl = invoiceLocale.startsWith('ar')
  const t = await getTranslations({ locale: invoiceLocale })

  const order = await getOrderById(id)
  if (!order || !order.isPaid) notFound()

  const invoice = await getOrCreateInvoiceForOrder(id, 'invoice')
  let creditNotes = await getCreditNotesForOrder(id)
  if (creditNotes.length === 0) {
    const legacyCreditNote = await getOrCreateCreditNoteForOrder(id)
    if (legacyCreditNote) creditNotes = [legacyCreditNote]
  }

  let invoiceSubmission = await getZatcaSubmission(invoice._id)
  if (!invoiceSubmission) {
    // Fulfillment creates the invoice and queues ZATCA together. If that step
    // failed, the invoice page is the lazy retry path: queue the submission and
    // fall back to the Phase 1 QR until it is reported.
    await queueZatcaForInvoice(invoice._id)
    invoiceSubmission = await getZatcaSubmission(invoice._id)
  }

  const creditEntries = await Promise.all(
    creditNotes.map(async (creditNote) => {
      let submission = await getZatcaSubmission(creditNote._id)
      if (!submission) {
        await queueZatcaForInvoice(creditNote._id)
        submission = await getZatcaSubmission(creditNote._id)
      }
      const qr = await QRCode.toDataURL(
        submission?.qrPayload ?? creditNote.qrPayload,
        { margin: 1, width: 220 }
      )
      return { creditNote, qr }
    })
  )

  const invoiceQr = await QRCode.toDataURL(
    invoiceSubmission?.qrPayload ?? invoice.qrPayload,
    { margin: 1, width: 220 }
  )

  const money = (amount: number) =>
    formatCurrency(amount, invoice.currency, invoiceLocale)
  const date = (value: Date | string) =>
    new Intl.DateTimeFormat(invoiceLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(value))
  const otherLang = isRtl ? 'en' : 'ar'

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      className='mx-auto max-w-4xl space-y-8 p-4 print:max-w-none print:p-0'
    >
      <div className='flex flex-wrap items-center justify-between gap-2 print:hidden'>
        <h1 className='h1-bold'>{t('Tax Invoice')}</h1>
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link href={`/${locale}/invoice/${id}?lang=${otherLang}`}>
              {isRtl ? 'English' : 'العربية'}
            </Link>
          </Button>
          <PrintButton label={t('Print Invoice')} />
        </div>
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
            {(invoice.seller.street || invoice.seller.city) && (
              <p className='text-sm'>
                {[
                  invoice.seller.street,
                  invoice.seller.buildingNumber,
                  invoice.seller.citySubdivision,
                  invoice.seller.city,
                  invoice.seller.postalCode,
                  invoice.seller.country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
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
                <th className='p-2 text-end'>{t('VAT')}</th>
                <th className='p-2 text-end'>{t('Total (incl VAT)')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className='border-b'>
                  <td className='p-2'>{item.name}</td>
                  <td className='p-2 text-end'>{item.quantity}</td>
                  <td className='p-2 text-end'>{money(item.unitPrice)}</td>
                  <td className='p-2 text-end'>{money(item.lineTotal)}</td>
                  <td className='p-2 text-end'>
                    {item.vatPercent > 0
                      ? `${money(item.vatAmount)} (${item.vatPercent}%)`
                      : money(item.vatAmount)}
                  </td>
                  <td className='p-2 text-end'>
                    {money(item.lineTotal + item.vatAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='ms-auto max-w-sm space-y-1 text-sm'>
          <div className='flex justify-between'>
            <span>{t('Subtotal (excl VAT)')}</span>
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
            <span>{t('Total (incl VAT)')}</span>
            <span>{money(invoice.total)}</span>
          </div>
        </div>

        <p className='text-xs text-muted-foreground'>{t('QrCodeNote')}</p>
      </section>

      {creditEntries.map(({ creditNote, qr }) => (
        <section
          key={creditNote._id}
          className='space-y-4 rounded-lg border p-6 print:border-0'
        >
          <header className='flex flex-col justify-between gap-4 border-b pb-4 md:flex-row'>
            <div>
              <h2 className='text-xl font-bold'>{t('Credit Note')}</h2>
              {creditNote.creditNoteReason &&
                creditNote.creditNoteReason !== 'legacy' && (
                  <p className='text-sm'>
                    {creditNote.creditNoteReason === 'cancellation'
                      ? t('Cancellation')
                      : t('Return')}
                  </p>
                )}
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

          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='border-y bg-muted/50'>
                <tr>
                  <th className='p-2 text-start'>{t('Description')}</th>
                  <th className='p-2 text-end'>{t('Quantity')}</th>
                  <th className='p-2 text-end'>{t('Unit Price')}</th>
                  <th className='p-2 text-end'>{t('VAT')}</th>
                  <th className='p-2 text-end'>{t('Total (incl VAT)')}</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.items.map((item, itemIndex) => (
                  <tr
                    key={`${item.name}-${itemIndex}`}
                    className='border-b'
                  >
                    <td className='p-2'>{item.name}</td>
                    <td className='p-2 text-end'>{item.quantity}</td>
                    <td className='p-2 text-end'>{money(item.unitPrice)}</td>
                    <td className='p-2 text-end'>
                      {item.vatPercent > 0
                        ? `${money(item.vatAmount)} (${item.vatPercent}%)`
                        : money(item.vatAmount)}
                    </td>
                    <td className='p-2 text-end'>
                      {money(item.lineTotal + item.vatAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-1 text-sm'>
              <div className='flex justify-between gap-8'>
                <span>{t('Subtotal (excl VAT)')}</span>
                <span>{money(creditNote.itemsPrice)}</span>
              </div>
              {creditNote.shippingPrice > 0 && (
                <div className='flex justify-between gap-8'>
                  <span>{t('Shipping')}</span>
                  <span>{money(creditNote.shippingPrice)}</span>
                </div>
              )}
              <div className='flex justify-between gap-8'>
                <span>{t('VAT')}</span>
                <span>{money(creditNote.vatAmount)}</span>
              </div>
              <div className='flex justify-between gap-8 border-t pt-1 text-base font-bold'>
                <span>{t('Total (incl VAT)')}</span>
                <span>{money(creditNote.total)}</span>
              </div>
              {creditNote.notes && (
                <p className='text-muted-foreground'>{creditNote.notes}</p>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t('QR Code')} width={140} height={140} />
          </div>
        </section>
      ))}

      <p className='text-center text-xs text-muted-foreground'>
        {t('InvoiceFooter')}
      </p>
    </main>
  )
}
