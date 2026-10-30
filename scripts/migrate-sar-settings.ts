import mongoose from 'mongoose'

import Setting from '../lib/db/models/setting.model'

/**
 * One-time migration for existing databases:
 * - makes SAR the base/default currency
 * - expresses all other rates relative to SAR
 * - ensures the known payment providers exist in settings
 *
 * WARNING: product prices keep their numeric values and are now interpreted
 * as SAR. Review product prices before going live.
 */
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)

  const setting = await Setting.findOne()
  if (!setting) {
    console.log('No settings document found; the seed defaults are already SAR.')
    return
  }

  const rates: Record<string, number> = {
    SAR: 1,
    USD: 0.2667,
    EUR: 0.245,
    AED: 0.979,
  }
  const symbols: Record<string, string> = {
    SAR: 'ر.س',
    USD: '$',
    EUR: '€',
    AED: 'AED',
  }

  const currencies = (setting.availableCurrencies ?? []).map((currency) => ({
    name: currency.name,
    code: currency.code,
    symbol: symbols[currency.code] ?? currency.symbol,
    convertRate: rates[currency.code] ?? currency.convertRate,
    locale: currency.locale ?? 'en-US',
    decimals: currency.decimals ?? 2,
    isBase: currency.code === 'SAR',
  }))

  if (!currencies.some((currency) => currency.code === 'SAR')) {
    currencies.unshift({
      name: 'Saudi Riyal',
      code: 'SAR',
      symbol: symbols.SAR,
      convertRate: 1,
      locale: 'en-US',
      decimals: 2,
      isBase: true,
    })
  }

  setting.availableCurrencies = currencies
  setting.defaultCurrency = 'SAR'

  const methods = (setting.availablePaymentMethods ?? []).map((method) => ({
    name: method.name,
  }))
  for (const name of ['Moyasar', 'Stripe', 'PayPal', 'Cash On Delivery']) {
    if (!methods.some((method) => method.name === name)) {
      methods.push({ name })
    }
  }

  setting.availablePaymentMethods = methods
  if (!methods.some((method) => method.name === setting.defaultPaymentMethod)) {
    setting.defaultPaymentMethod = 'Moyasar'
  }

  await setting.save()

  console.log('Settings migrated to SAR.')
  console.log(
    'Review product prices: their numeric values are now interpreted as SAR.'
  )
}

main()
  .catch((error) => {
    console.error('SAR migration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
