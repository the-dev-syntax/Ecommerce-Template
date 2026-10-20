import mongoose from 'mongoose'

import data from '../lib/data'
import Setting from '../lib/db/models/setting.model'

/**
 * One-time migration for existing databases:
 * - sets the Saudi market as the default
 * - adds the seller/VAT identity and invoice numbering settings
 *
 * Existing values are preserved; only missing fields are filled from the seed.
 */
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)

  const setting = await Setting.findOne()
  if (!setting) {
    console.log('No settings document found; seed defaults are already Saudi.')
    return
  }

  const defaults = data.settings[0]

  setting.market = setting.market ?? 'SA'
  setting.seller = {
    ...defaults.seller,
    ...(setting.seller ?? {}),
  }
  setting.invoice = {
    ...defaults.invoice,
    ...(setting.invoice ?? {}),
  }

  await setting.save()

  console.log('Settings migrated to the Saudi market defaults.')
  console.log(
    `Seller: ${setting.seller.legalNameEn} / ${setting.seller.legalNameAr}`
  )
  console.log(`VAT: ${setting.seller.vatNumber}`)
  console.log(
    `Invoice prefix: ${setting.invoice.prefix}, sequence length: ${setting.invoice.sequenceLength}`
  )
}

main()
  .catch((error) => {
    console.error('Saudi settings migration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
