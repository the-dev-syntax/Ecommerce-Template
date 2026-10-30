'use server'

import crypto from 'crypto'

import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/db'
import User from '@/lib/db/models/user.model'
import { normalizeSaudiPhone } from '@/lib/phone'
import { formatError } from '@/lib/utils'
import { UserAddressSchema } from '@/lib/validator'
import type { UserAddress } from '@/types'

const MAX_ADDRESSES = 10

export type AddressActionResult = {
  success: boolean
  message: string
  data?: UserAddress[]
}

function sortAddresses(addresses: UserAddress[]) {
  return [...addresses].sort(
    (a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)
  )
}

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('User not authenticated')
  return session.user.id
}

async function readAddresses(userId: string): Promise<UserAddress[]> {
  const user = await User.findById(userId).select({ addresses: 1 }).lean()
  return (user?.addresses ?? []) as unknown as UserAddress[]
}

export async function getUserAddresses(): Promise<UserAddress[]> {
  const session = await auth()
  if (!session?.user?.id) return []
  await connectToDatabase()
  return sortAddresses(await readAddresses(session.user.id))
}

export async function saveUserAddress(
  input: UserAddress
): Promise<AddressActionResult> {
  try {
    const userId = await requireUserId()
    await connectToDatabase()

    const data = UserAddressSchema.parse(input)
    const phone = normalizeSaudiPhone(data.phone)
    if (!phone)
      throw new Error(
        'Enter a valid Saudi mobile number (+966 followed by 9 digits)'
      )

    // Only numbers verified by OTP can be saved to the address book.
    const owner = await User.findById(userId)
      .select({ phone: 1, phoneVerified: 1, verifiedPhones: 1 })
      .lean()
    const verifiedPhones = new Set(
      (owner?.verifiedPhones ?? []).map((entry) => entry.phone)
    )
    if (owner?.phoneVerified && owner.phone) verifiedPhones.add(owner.phone)
    if (!verifiedPhones.has(phone))
      throw new Error('Verify this phone number before saving it.')

    data.phone = phone
    const addresses = await readAddresses(userId)
    const requestedId = data.id?.trim()
    let savedId = requestedId

    if (requestedId) {
      const index = addresses.findIndex((address) => address.id === requestedId)
      if (index === -1) throw new Error('Address not found')
      addresses[index] = { ...addresses[index], ...data, id: requestedId }
    } else {
      if (addresses.length >= MAX_ADDRESSES)
        throw new Error(`You can save up to ${MAX_ADDRESSES} addresses`)

      savedId = crypto.randomUUID()
      addresses.push({ ...data, id: savedId })
    }

    // Exactly one default: a newly flagged address wins, the first saved
    // address becomes the default, and un-flagging never leaves zero defaults.
    const makeDefault = !!data.isDefault || addresses.length === 1
    const next = addresses.map((address) => ({
      ...address,
      isDefault: makeDefault ? address.id === savedId : !!address.isDefault,
    }))
    if (!next.some((address) => address.isDefault)) next[0].isDefault = true

    await User.updateOne({ _id: userId }, { $set: { addresses: next } })

    return {
      success: true,
      message: 'Address saved',
      data: sortAddresses(next),
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function deleteUserAddress(
  id: string
): Promise<AddressActionResult> {
  try {
    const userId = await requireUserId()
    await connectToDatabase()

    const addresses = await readAddresses(userId)
    const remaining = addresses.filter((address) => address.id !== id)
    if (remaining.length === addresses.length)
      throw new Error('Address not found')

    // Promote another address when the default was deleted.
    if (remaining.length > 0 && !remaining.some((address) => address.isDefault))
      remaining[0].isDefault = true

    await User.updateOne({ _id: userId }, { $set: { addresses: remaining } })

    return {
      success: true,
      message: 'Address deleted',
      data: sortAddresses(remaining),
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function setDefaultUserAddress(
  id: string
): Promise<AddressActionResult> {
  try {
    const userId = await requireUserId()
    await connectToDatabase()

    const addresses = await readAddresses(userId)
    if (!addresses.some((address) => address.id === id))
      throw new Error('Address not found')

    const next = addresses.map((address) => ({
      ...address,
      isDefault: address.id === id,
    }))

    await User.updateOne({ _id: userId }, { $set: { addresses: next } })

    return {
      success: true,
      message: 'Default address updated',
      data: sortAddresses(next),
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
