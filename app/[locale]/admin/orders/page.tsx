import Link from 'next/link'

import { auth } from '@/auth'
import DeleteDialog from '@/components/shared/delete-dialog'
import Pagination from '@/components/shared/pagination'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deleteOrder, getAllOrders } from '@/lib/actions/order.actions'
import { formatDateTime, formatId } from '@/lib/utils'
import { IOrderList } from '@/types'
import ProductPrice from '@/components/shared/product/product-price'
import { getTranslations } from 'next-intl/server'


export async function generateMetadata(){
   const t = await getTranslations("Admin")
   return {
     title: t('Admin Orders')
   }
}

export default async function OrdersPage(props: {
  searchParams: Promise<{ page: string }>
}) {
  const searchParams = await props.searchParams

  const { page = '1' } = searchParams

  const session = await auth()
  if (session?.user.role !== 'Admin')
    throw new Error('Admin permission required')

  const orders = await getAllOrders({
    page: Number(page),
  })

  const t = await getTranslations("Admin")

    if (!orders.data || orders.data.length === 0) {
    return (
    <div className='space-y-2'>
        <h1 className='h1-bold'>{t('Orders')}</h1>
        <p className='text-muted-foreground'>{t('No orders found')}.</p>
    </div>
    )
  }

  return (
    <div className='space-y-2'>
      <h1 className='h1-bold'>{t('Orders')}</h1>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Id')}</TableHead>
              <TableHead>{t('Date')}</TableHead>
              <TableHead>{t('Buyer')}</TableHead>
              <TableHead>{t('Total')}</TableHead>
              <TableHead>{t('Paid')}</TableHead>
              <TableHead>{t('Delivered')}</TableHead>
              <TableHead>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data.map((order: IOrderList) => (
              <TableRow key={order._id}>
                <TableCell>{formatId(order._id)}</TableCell>
                <TableCell>
                  {formatDateTime(order.createdAt!).dateTime}
                </TableCell>
                <TableCell>
                  {order.user ? order.user.name : t('Deleted User')}
                </TableCell>
                <TableCell>
                  {' '}
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
                <TableCell className='flex gap-1'>
                  <Button asChild variant='outline' size='sm'>
                    <Link href={`/admin/orders/${order._id}`}>{t('Details')}</Link>
                  </Button>
                  <DeleteDialog id={order._id} action={deleteOrder} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {orders.totalPages > 1 && (
          <Pagination page={page} totalPages={orders.totalPages!} />
        )}
      </div>
    </div>
  )
}