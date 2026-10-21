import mongoose from 'mongoose'

import ShippingRate from '../lib/db/models/shipping-rate.model'

/** Seed SMSA flat per-city defaults until the commercial rate card arrives. */
const cities = [
  ['Riyadh', 'Riyadh', 20, 1, 2],
  ['Jeddah', 'Makkah', 25, 2, 3],
  ['Makkah', 'Makkah', 25, 2, 3],
  ['Madinah', 'Madinah', 25, 2, 3],
  ['Dammam', 'Eastern Province', 25, 2, 3],
  ['Khobar', 'Eastern Province', 25, 2, 3],
  ['Dhahran', 'Eastern Province', 25, 2, 3],
  ['Taif', 'Makkah', 25, 2, 3],
  ['Abha', 'Asir', 25, 2, 4],
  ['Tabuk', 'Tabuk', 25, 2, 4],
  ['Buraidah', 'Qassim', 25, 2, 3],
  ['Hail', 'Hail', 25, 2, 4],
  ['Najran', 'Najran', 25, 2, 4],
  ['Jazan', 'Jazan', 25, 2, 4],
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'
  const existing = await ShippingRate.countDocuments()
  if (existing > 0 && !process.argv.includes('--force')) {
    console.log(`Shipping rates already exist (${existing}); nothing to seed.`)
    return
  }

  const rows = cities.map(([city, region, baseRate, minDays, maxDays]) => ({
    zoneName: region,
    country: 'Saudi Arabia',
    region,
    city,
    carrier: 'SMSA',
    serviceName: 'Express',
    baseRate,
    includedWeightKg: 1,
    extraPerKg: 5,
    weightRoundingKg: 1,
    freeShippingMinPrice: 200,
    codFee: 10,
    remoteSurcharge: 0,
    etaMinDays: minDays,
    etaMaxDays: maxDays,
    pickupAvailable: true,
    codAvailable: true,
    isActive: true,
    priority: 10,
  }))

  rows.push({
    zoneName: 'Saudi Arabia',
    country: 'Saudi Arabia',
    region: '*',
    city: '*',
    carrier: 'SMSA',
    serviceName: 'Express',
    baseRate: 30,
    includedWeightKg: 1,
    extraPerKg: 5,
    weightRoundingKg: 1,
    freeShippingMinPrice: 200,
    codFee: 10,
    remoteSurcharge: 0,
    etaMinDays: 3,
    etaMaxDays: 5,
    pickupAvailable: true,
    codAvailable: true,
    isActive: true,
    priority: 0,
  })

  if (!dryRun) {
    await ShippingRate.deleteMany({})
    await ShippingRate.insertMany(rows)
  }
  console.log(
    `${dryRun ? 'Would seed' : 'Seeded'} ${rows.length} SMSA default shipping rates.`
  )
}

main()
  .catch((error) => {
    console.error(
      'Shipping rate migration failed:',
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
