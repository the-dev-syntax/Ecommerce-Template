import { notFound } from 'next/navigation'
import React from 'react'

import { auth } from '@/auth'
import { getOrderById } from '@/lib/actions/order.actions'
import OrderDetailsForm from '@/components/shared/order/order-details-form'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export const metadata = {
  title: 'Order Details',
}

const OrderDetailsPage = async (props: {
  params: Promise<{
    id: string
  }>
}) => {
  const params = await props.params

  const { id } = params

  const session = await auth()

  const order = await getOrderById(id)
  if (!order) notFound()

  const t = await getTranslations('Admin')

  return (
    <main className='max-w-6xl mx-auto p-4'>
      <div className='flex mb-4'>
       <Link href='/admin/orders'>{t('Orders')}</Link> <span className='mx-1'>›</span>
        <Link href={`/admin/orders/${order._id}`}>{order._id}</Link>
      </div>
      <OrderDetailsForm
        order={order}
        isAdmin={session?.user?.role === 'Admin' || false}
      />
    </main>
  )
}

export default OrderDetailsPage

