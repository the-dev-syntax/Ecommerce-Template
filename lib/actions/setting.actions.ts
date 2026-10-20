'use server'
import { ISettingInput } from '@/types'
import Setting from '../db/models/setting.model'
import Invoice from '../db/models/invoice.model'
import { connectToDatabase } from '../db'
import { formatError } from '../utils'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { withSettingDefaults } from '../settings-defaults'

const globalForSettings = global as unknown as {
  cachedSettings: ISettingInput | null
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
  if (!globalForSettings.cachedSettings) {
    await connectToDatabase()
    const setting = await Setting.findOne().lean()
    globalForSettings.cachedSettings = withSettingDefaults(
      setting ? (JSON.parse(JSON.stringify(setting)) as ISettingInput) : null
    )
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

    const current = await Setting.findOne().lean()
    const invoiceCount = await Invoice.countDocuments()
    if (
      invoiceCount > 0 &&
      current &&
      newSetting.invoice &&
      (current.invoice?.prefix !== newSetting.invoice.prefix ||
        current.invoice?.sequenceLength !== newSetting.invoice.sequenceLength)
    ) {
      return {
        success: false,
        message:
          'Invoice numbering is locked after the first invoice is issued.',
      }
    }

    const updatedSetting = await Setting.findOneAndUpdate({}, newSetting, {
      upsert: true,
      new: true,
    }).lean()

    globalForSettings.cachedSettings = JSON.parse( JSON.stringify(updatedSetting)) // Update the cache

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