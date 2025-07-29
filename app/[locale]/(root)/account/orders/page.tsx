import Link from 'next/link'

import Pagination from '@/components/shared/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getMyOrders } from '@/lib/actions/order.actions'
import { IOrder } from '@/lib/db/models/order.model'
import { formatDateTime, formatId } from '@/lib/utils'
import BrowsingHistoryList from '@/components/shared/browsing-history-list'
import ProductPrice from '@/components/shared/product/product-price'
import { getTranslations } from 'next-intl/server'

//{ params: { locale } }: { params: { locale: string }}
export async function generateMetadata() {
  const t = await getTranslations('ProfileManager');
  return {
    title: t('YourOrders'),
  };
}
export default async function OrdersPage(props: {  searchParams: Promise<{ page: string }>}) {

  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1

  const orders = await getMyOrders({ page })

  const t = await getTranslations('ProfileManager')

  return (
    <div>
      <div className='flex gap-2'>
        <Link href='/account'>{t('YourOrders')}</Link>
        <span>›</span>
        <span>{t('YourOrders')}</span>
      </div>
      <h1 className='h1-bold pt-4'>{t('YourOrders')}</h1>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Id')}</TableHead>
              <TableHead>{t('Date')}</TableHead>
              <TableHead>{t('Total')}</TableHead>
              <TableHead>{t('Paid')}</TableHead>
              <TableHead>{t('Delivered')}</TableHead>
              <TableHead>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className=''>
                  {t("YouHaveNoOrders")}
                </TableCell>
              </TableRow>
            )}
            {orders.data.map((order: IOrder) => (
              <TableRow key={order._id}>
                <TableCell>
                  <Link href={`/account/orders/${order._id}`}>
                    {formatId(order._id)}
                  </Link>
                </TableCell>
                <TableCell>
                  {formatDateTime(order.createdAt!).dateTime}
                </TableCell>
                <TableCell>
                  <ProductPrice price={order.totalPrice} plain />
                </TableCell>
                <TableCell>
                  {order.isPaid && order.paidAt
                    ? formatDateTime(order.paidAt).dateTime
                    : t('No')}
                </TableCell>
                <TableCell>
                  {order.isDelivered && order.deliveredAt
                    ? formatDateTime(order.deliveredAt).dateTime
                    : t('No')}
                </TableCell>
                <TableCell>
                  <Link href={`/account/orders/${order._id}`}>
                    <span className='px-2'>{t('Details')}</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {orders.totalPages > 1 && (
          <Pagination page={page} totalPages={orders.totalPages} />
        )}
      </div>
      <BrowsingHistoryList className='mt-16' />
    </div>
  )
}