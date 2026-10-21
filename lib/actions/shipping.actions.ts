'use server'

import { auth } from '@/auth'
import { requireAdmin } from '@/lib/access'
import { connectToDatabase } from '@/lib/db'
import ShippingRate from '@/lib/db/models/shipping-rate.model'
import { ShippingRateSchema, ShippingRateUpdateSchema } from '@/lib/validator'
import type { IShippingRate, IShippingRateUpdate } from '@/types'
import { formatError } from '@/lib/utils'
import { revalidateAllLocales } from '@/lib/utils-serverOnly'

export async function getShippingRatesAdmin() {
  requireAdmin(await auth())
  await connectToDatabase()
  const rates = await ShippingRate.find().sort({ priority: -1 }).lean()
  return JSON.parse(JSON.stringify(rates)) as IShippingRateUpdate[]
}

export async function upsertShippingRate(input: IShippingRate & { _id?: string }) {
  try {
    requireAdmin(await auth())
    await connectToDatabase()
    if (input._id) {
      const parsed = ShippingRateUpdateSchema.parse(input)
      const { _id, ...values } = parsed
      await ShippingRate.findByIdAndUpdate(_id, values)
    } else {
      const parsed = ShippingRateSchema.parse(input)
      await ShippingRate.create(parsed)
    }
    await revalidateAllLocales('/admin/shipping')
    await revalidateAllLocales('/checkout')
    return { success: true, message: 'Shipping rate saved' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function deleteShippingRate(id: string) {
  try {
    requireAdmin(await auth())
    await connectToDatabase()
    await ShippingRate.findByIdAndDelete(id)
    await revalidateAllLocales('/admin/shipping')
    await revalidateAllLocales('/checkout')
    return { success: true, message: 'Shipping rate deleted' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function toggleShippingRate(id: string, isActive: boolean) {
  try {
    requireAdmin(await auth())
    await connectToDatabase()
    await ShippingRate.findByIdAndUpdate(id, { isActive })
    await revalidateAllLocales('/admin/shipping')
    await revalidateAllLocales('/checkout')
    return { success: true, message: 'Shipping rate updated' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
