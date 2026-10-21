'use client'

import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IOrder } from '@/lib/db/models/order.model'
import { deriveOrderStatus } from '@/lib/orders/status'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import ProductPrice from '../product/product-price'
import ActionButton from '../action-button'
import RefundOrderForm from './refund-order-form'
import ShipOrderForm from './ship-order-form'
import { deliverOrder, updateOrderToPaid } from '@/lib/actions/order.actions'
import { useTranslations } from 'next-intl'

export default function OrderDetailsForm({
  order,
  isAdmin,
}: {
  order: IOrder
  isAdmin: boolean
}) {

  const t = useTranslations()
  const {
    shippingAddress,
    items,
    itemsPrice,
    taxPrice,
    shippingPrice,
    taxInclusive = true,
    totalPrice,
    paymentMethod,
    isPaid,
    paidAt,
    isDelivered,
    deliveredAt,
    expectedDeliveryDate,
    isCancelled,
    cancelledAt,
    cancelReason,
    refundedAmount,
  } = order

  return (
    <div className='grid md:grid-cols-3 md:gap-5'>
      <div className='overflow-x-auto md:col-span-2 space-y-4'>
        <Card>
          <CardContent className='p-4 gap-4'>
            <h2 className='text-xl pb-4'>{t('Shipping address')}</h2>
            <p>
              {shippingAddress.fullName} {shippingAddress.phone}
            </p>
            <p>
              {shippingAddress.street}, {shippingAddress.city},{' '}
              {shippingAddress.province}, {shippingAddress.postalCode},{' '}
              {shippingAddress.country}{' '}
            </p>
            {shippingAddress.district && (
              <p className='text-muted-foreground text-sm'>
                {t('District')}: {shippingAddress.district}
              </p>
            )}
            {shippingAddress.nationalAddress && (
              <p className='text-muted-foreground text-sm'>
                {t('National address')}: {shippingAddress.nationalAddress}
              </p>
            )}
            {order.shippingCarrier && (
              <p className='text-sm'>
                {t('Shipping')}: {order.shippingCarrier}{' '}
                {order.shippingService} ({formatCurrency(order.shippingPrice, order.currency)})
              </p>
            )}
            {order.isPickup && (
              <p className='text-sm'>
                {t('Pickup from')}: {order.pickupLocation}
              </p>
            )}
            {order.codFee ? (
              <p className='text-sm'>
                {t('COD fee')}: {formatCurrency(order.codFee, order.currency)}
              </p>
            ) : null}

            {isDelivered ? (
              <Badge>
                {t('Delivered at')} {formatDateTime(deliveredAt!).dateTime}
              </Badge>
            ) : (
              <div>
                {' '}
                <Badge variant='destructive'>{t('Not delivered')}</Badge>
                <div>
                  {t('Expected delivery at')}{' '}
                  {formatDateTime(expectedDeliveryDate!).dateTime}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4 gap-4'>
            <h2 className='text-xl pb-4'>{t('Payment Method')}</h2>
            <p>{paymentMethod}</p>
            <div className='flex flex-wrap items-center gap-2'>
              {isCancelled ? (
                <Badge variant='destructive'>
                  {t('Cancelled')}
                  {cancelledAt
                    ? ` ${formatDateTime(cancelledAt).dateTime}`
                    : ''}
                </Badge>
              ) : isPaid ? (
                <Badge>Paid at {formatDateTime(paidAt!).dateTime}</Badge>
              ) : (
                <Badge variant='destructive'>{t('Not paid')}</Badge>
              )}
              {(refundedAmount ?? 0) > 0 && (
                <Badge variant='secondary'>
                  {t('Refunded')}:{' '}
                  {formatCurrency(refundedAmount!, order.currency)}
                </Badge>
              )}
            </div>
            {cancelReason && (
              <p className='text-muted-foreground text-sm'>
                {t('Cancellation reason')}: {cancelReason}
              </p>
            )}
            {order.shipment?.trackingNumber && (
              <p className='text-sm'>
                {t('Tracking number')}:{' '}
                {order.shipment.trackingUrl ? (
                  <Link
                    href={order.shipment.trackingUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='underline'
                  >
                    {order.shipment.trackingNumber}
                  </Link>
                ) : (
                  order.shipment.trackingNumber
                )}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4   gap-4'>
            <h2 className='text-xl pb-4'>{t('Order Items')}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Item')}</TableHead>
                  <TableHead>{t('Quantity')}</TableHead>
                  <TableHead>{t('Return policy')}</TableHead>
                  <TableHead>{t('Price')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.slug}>
                    <TableCell>
                      <Link
                        href={`/product/${item.slug}`}
                        className='flex items-center'
                      >
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={50}
                          height={50}
                        ></Image>
                        <span className='px-2'>{item.name}</span>
                        {item.variantLabel && (
                          <span className='text-muted-foreground block px-2 text-xs'>
                            {item.variantLabel}
                            {item.sku ? ` · ${item.sku}` : ''}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className='px-2'>{item.quantity}</span>
                      {(item.refundedQuantity ?? 0) > 0 && (
                        <span className='text-muted-foreground block px-2 text-xs'>
                          {t('Refunded quantity')}: {item.refundedQuantity}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.returnPolicy === 'final_sale'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {item.returnPolicy === 'final_sale'
                          ? t('Final sale')
                          : item.returnPolicy === 'refund_only'
                            ? t('Refund only')
                            : t('Return and refund')}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatCurrency(item.price, order.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4 gap-4'>
            <h2 className='text-xl pb-4'>{t('Order status')}</h2>
            <p className='mb-2 font-medium'>{deriveOrderStatus(order)}</p>
            <ul className='space-y-1 text-sm'>
              {(order.statusHistory ?? []).map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  {formatDateTime(entry.at).dateTime} — {entry.status}
                  {entry.note ? ` (${entry.note})` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card>
          <CardContent className='p-4  space-y-4 gap-4'>
            <h2 className='text-xl pb-4'>{t('Order Summary')}</h2>
            <div className='flex justify-between'>
              <div>{t('Items')}</div>
              <div>
                {' '}
                <ProductPrice price={itemsPrice} plain convert={false} currencyCode={order.currency} />
              </div>
            </div>
            <div className='flex justify-between'>
              <div>{taxInclusive ? t('VAT (included)') : t('VAT')}</div>
              <div>
                {' '}
                <ProductPrice price={taxPrice} plain convert={false} currencyCode={order.currency} />
              </div>
            </div>
            <div className='flex justify-between'>
              <div>{t('Shipping')}</div>
              <div>
                {' '}
                <ProductPrice price={shippingPrice} plain convert={false} currencyCode={order.currency} />
              </div>
            </div>
            <div className='flex justify-between'>
              <div>{t('Total')}</div>
              <div>
                {' '}
                <ProductPrice price={totalPrice} plain convert={false} currencyCode={order.currency} />
              </div>
            </div>

            {!isPaid &&
              !isCancelled &&
              ['Stripe', 'PayPal', 'Moyasar'].includes(paymentMethod) && (
                <Link
                  className={cn(buttonVariants(), 'w-full')}
                  href={`/checkout/${order._id}`}
                >
                  {t('Pay Order')}
                </Link>
              )}
            {isAdmin && !isPaid && paymentMethod === 'Cash On Delivery' && (
              <ActionButton
                caption={t('Mark as paid')}
                action={() => updateOrderToPaid(order._id)}
              />
            )}
            {isAdmin && isPaid && !isDelivered && !isCancelled && (
              <>
                <ShipOrderForm orderId={order._id} />
                <ActionButton
                  caption={t('Mark as delivered')}
                  action={() => deliverOrder(order._id)}
                />
              </>
            )}
            {isPaid && (
              <Link
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
                href={`/invoice/${order._id}`}
              >
                {t('View Invoice')}
              </Link>
            )}
            {isAdmin && <RefundOrderForm order={order} />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}