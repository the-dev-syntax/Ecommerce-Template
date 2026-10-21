import mongoose from 'mongoose'

import Setting from '../lib/db/models/setting.model'
import { withSettingDefaults } from '../lib/settings-defaults'

/**
 * Backfill the Phase 1A white-label settings on an existing database.
 *
 * Run once after deploying P0-25:
 *   npm run migrate:whitelabel
 */
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'

  const setting = await Setting.findOne()
  if (!setting) {
    console.log('No settings document found; seed defaults already include white-label fields.')
    return
  }

  const current = JSON.parse(JSON.stringify(setting))
  const merged = withSettingDefaults(current)
  const baseCode =
    merged.market === 'SA' ? 'SAR' : merged.defaultCurrency
  const availableCurrencies = merged.availableCurrencies.map((currency) => ({
    ...currency,
    isBase: currency.code === baseCode,
  }))
  const update = {
    brand: merged.brand,
    seo: merged.seo,
    features: merged.features,
    navigation: merged.navigation,
    email: merged.email,
    emailTemplates: merged.emailTemplates,
    availableCurrencies,
    defaultCurrency: baseCode,
  }

  if (!dryRun) {
    await Setting.updateOne({ _id: setting._id }, { $set: update })
  }

  console.log(
    `${dryRun ? 'Would backfill' : 'Backfilled'} white-label settings (brand, SEO, features, navigation, email, templates).`
  )
}

main()
  .catch((error) => {
    console.error(
      'White-label settings migration failed:',
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
