'use client'

import { redirect } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'

import CheckoutFooter from '../checkout-footer'
import { Card, CardContent } from '@/components/ui/card'
import ProductPrice from '@/components/shared/product/product-price'
import useCartStore from '@/hooks/use-cart-store'
import type { IOrder } from '@/lib/db/models/order.model'
import { formatCurrency, formatDateTime, localizedPath } from '@/lib/utils'

import PaymentPanel from './payment-panel'

export default function OrderPaymentForm({
  order,
  paypalClientId,
  moyasarPublishableKey,
}: {
  order: IOrder
  paypalClientId: string
  isAdmin: boolean
  moyasarPublishableKey: string
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const { clearCart } = useCartStore()

  const {
    shippingAddress,
    items,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    taxInclusive = true,
    codFee = 0,
    paymentMethod,
    expectedDeliveryDate,
    isPaid,
    isCancelled,
  } = order

  if (isPaid || isCancelled) {
    redirect(localizedPath(locale, `/account/orders/${order._id}`))
  }

  const handlePaid = () => {
    clearCart()
    router.push(`/account/orders/${order._id}`)
    router.refresh()
  }

  const CheckoutSummary = () => (
    <Card>
      <CardContent className='p-4'>
        <div className='text-lg font-bold'>{t('Order Summary')}</div>
        <div className='space-y-2'>
          <div className='flex justify-between'>
            <span>{t('Items')}:</span>
            <span>
              <ProductPrice
                price={itemsPrice}
                plain
                convert={false}
                currencyCode={order.currency}
              />
            </span>
          </div>
          <div className='flex justify-between'>
            <span>{t('Shipping & Handling')}:</span>
            <span>
              {shippingPrice === undefined ? (
                '--'
              ) : shippingPrice === 0 ? (
                t('FREE')
              ) : (
                <ProductPrice
                  price={shippingPrice}
                  plain
                  convert={false}
                  currencyCode={order.currency}
                />
              )}
            </span>
          </div>
          <div className='flex justify-between'>
            <span>{taxInclusive ? t('VAT (included)') : t('VAT')}:</span>
            <span>
              {taxPrice === undefined ? (
                '--'
              ) : (
                <ProductPrice
                  price={taxPrice}
                  plain
                  convert={false}
                  currencyCode={order.currency}
                />
              )}
            </span>
          </div>
          {codFee > 0 && (
            <div className='flex justify-between'>
              <span>{t('COD fee')}:</span>
              <span>
                <ProductPrice
                  price={codFee}
                  plain
                  convert={false}
                  currencyCode={order.currency}
                />
              </span>
            </div>
          )}
          <div className='flex justify-between pt-1 font-bold text-lg'>
            <span>{t('Order Total')}:</span>
            <span>
              <ProductPrice
                price={totalPrice}
                plain
                convert={false}
                currencyCode={order.currency}
              />
            </span>
          </div>

          {!isPaid && (
            <PaymentPanel
              order={order}
              paypalClientId={paypalClientId}
              moyasarPublishableKey={moyasarPublishableKey}
              onPaid={handlePaid}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <main className='max-w-6xl mx-auto'>
      <div className='grid md:grid-cols-4 gap-6'>
        <div className='md:col-span-3'>
          <div>
            <div className='grid md:grid-cols-3 my-3 pb-3'>
              <div className='text-lg font-bold'>
                <span>{t('Shipping address')}</span>
              </div>
              <div className='col-span-2'>
                <p>
                  {shippingAddress.fullName} <br />
                  {shippingAddress.street} <br />
                  {`${shippingAddress.city}, ${shippingAddress.province}, ${shippingAddress.postalCode}, ${shippingAddress.country}`}
                </p>
              </div>
            </div>
          </div>

          <div className='border-y'>
            <div className='grid md:grid-cols-3 my-3 pb-3'>
              <div className='text-lg font-bold'>
                <span>{t('Payment Method')}</span>
              </div>
              <div className='col-span-2'>
                <p>{paymentMethod}</p>
              </div>
            </div>
          </div>

          <div className='grid md:grid-cols-3 my-3 pb-3'>
            <div className='flex text-lg font-bold'>
              <span>{t('Items and shipping')}</span>
            </div>
            <div className='col-span-2'>
              <p>
                {t('Delivery date')}:
                {formatDateTime(expectedDeliveryDate).dateOnly}
              </p>
              <ul>
                {items.map((item) => (
                  <li key={item.clientId}>
                    {item.name}
                    {item.variantLabel ? ` (${item.variantLabel})` : ''} x{' '}
                    {item.quantity} ={' '}
                    {formatCurrency(
                      item.price * item.quantity,
                      order.currency
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className='block md:hidden'>
            <CheckoutSummary />
          </div>

          <CheckoutFooter />
        </div>
        <div className='hidden md:block'>
          <CheckoutSummary />
        </div>
      </div>
    </main>
  )
}
