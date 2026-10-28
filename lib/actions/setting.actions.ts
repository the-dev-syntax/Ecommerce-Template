'use server'
import { ISettingInput } from '@/types'
import Setting from '../db/models/setting.model'
import Invoice from '../db/models/invoice.model'
import { connectToDatabase } from '../db'
import { formatError } from '../utils'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { withSettingDefaults } from '../settings-defaults'
import { SettingInputSchema } from '../validator'

const SETTINGS_CACHE_TTL_MS = 30_000
const globalForSettings = global as unknown as {
  cachedSettings: ISettingInput | null
  cachedAt?: number
}
export const getNoCachedSetting = async (): Promise<ISettingInput> => {
  const session = await auth()
  if (session?.user.role !== 'admin')
    throw new Error('Admin permission required')

  await connectToDatabase()
  const setting = await Setting.findOne().lean()
  return withSettingDefaults(
    setting ? (JSON.parse(JSON.stringify(setting)) as ISettingInput) : null
  )
}

export const getSetting = async (): Promise<ISettingInput> => {
  // Short TTL so a settings change made in another serverless instance is
  // picked up without a redeploy, while still avoiding a read on every page.
  const isStale =
    !globalForSettings.cachedSettings ||
    !globalForSettings.cachedAt ||
    Date.now() - globalForSettings.cachedAt > SETTINGS_CACHE_TTL_MS

  if (isStale) {
    await connectToDatabase()
    const setting = await Setting.findOne().lean()
    globalForSettings.cachedSettings = withSettingDefaults(
      setting ? (JSON.parse(JSON.stringify(setting)) as ISettingInput) : null
    )
    globalForSettings.cachedAt = Date.now()
  }
  return globalForSettings.cachedSettings as ISettingInput
}

// UPDATE SETTINGS - ADMIN
export const updateSetting = async (newSetting: ISettingInput) => {  

    const session = await auth()
    if (session?.user.role !== "admin"){
      throw new Error('Admin permission required')
    }

    try {   
    await connectToDatabase()

    // Validate the admin payload before writing. The Mongoose defaults are a
    // safety net, not a substitute for rejecting a malformed settings object.
    const validatedSetting = SettingInputSchema.parse(newSetting)

    const current = await Setting.findOne().lean()
    const invoiceCount = await Invoice.countDocuments()
    if (
      invoiceCount > 0 &&
      current &&
      validatedSetting.invoice &&
      (current.invoice?.prefix !== validatedSetting.invoice.prefix ||
        current.invoice?.sequenceLength !== validatedSetting.invoice.sequenceLength)
    ) {
      return {
        success: false,
        message:
          'Invoice numbering is locked after the first invoice is issued.',
      }
    }

    const updatedSetting = await Setting.findOneAndUpdate({}, validatedSetting, {
      upsert: true,
      new: true,
    }).lean()

    globalForSettings.cachedSettings = JSON.parse( JSON.stringify(updatedSetting)) // Update the cache
    globalForSettings.cachedAt = Date.now()

    return {
      success: true,
      message: 'Setting updated successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// Server action to update the currency cookie
export const setCurrencyOnServer = async (newCurrency: string) => {
  'use server'

  const setting = await getSetting()
  const isAvailable = setting.availableCurrencies.some(
    (currency) => currency.code === newCurrency
  )

  if (!isAvailable)
    return { success: false, message: 'Invalid currency' }

  const cookiesStore = await cookies()
  cookiesStore.set('currency', newCurrency, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })

  return {
    success: true,
    message: 'Currency updated successfully',
  }
}