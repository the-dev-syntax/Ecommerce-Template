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

    const parsed = input._id
      ? ShippingRateUpdateSchema.parse(input)
      : ShippingRateSchema.parse(input)

    // Two identical service/area rows create duplicate checkout options and
    // make the persisted delivery index ambiguous.
    const duplicate = await ShippingRate.findOne({
      ...(input._id ? { _id: { $ne: input._id } } : {}),
      country: parsed.country,
      region: parsed.region,
      city: parsed.city,
      carrier: parsed.carrier,
      serviceName: parsed.serviceName,
    }).collation({ locale: 'en', strength: 2 })
    if (duplicate) {
      return {
        success: false,
        message:
          'A rate for this carrier, service and area already exists. Edit that rate instead.',
      }
    }

    if (input._id) {
      const { _id, ...values } = parsed as IShippingRateUpdate
      await ShippingRate.findByIdAndUpdate(_id, values)
    } else {
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
