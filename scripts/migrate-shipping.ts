import mongoose from 'mongoose'

import ShippingRate from '../lib/db/models/shipping-rate.model'

type RateTier = {
  serviceName: string
  baseRate: number
  etaMinDays: number
  etaMaxDays: number
  freeShippingEnabled: boolean
}

// Riyadh gets free next-day delivery once the basket reaches the threshold.
const riyadhTiers: RateTier[] = [
  {
    serviceName: 'Tomorrow',
    baseRate: 20,
    etaMinDays: 1,
    etaMaxDays: 1,
    freeShippingEnabled: true,
  },
]

// Outside Riyadh the slow 5-day service is the free one. Next-day and 3-day
// delivery stay paid even when the basket is above the free-shipping threshold.
const outsideRiyadhTiers: RateTier[] = [
  {
    serviceName: 'Tomorrow',
    baseRate: 45,
    etaMinDays: 1,
    etaMaxDays: 1,
    freeShippingEnabled: false,
  },
  {
    serviceName: 'Next 3 Days',
    baseRate: 35,
    etaMinDays: 3,
    etaMaxDays: 3,
    freeShippingEnabled: false,
  },
  {
    serviceName: 'Next 5 Days',
    baseRate: 25,
    etaMinDays: 5,
    etaMaxDays: 5,
    freeShippingEnabled: true,
  },
]

const cities: [string, string][] = [
  ['Riyadh', 'Riyadh'],
  ['Jeddah', 'Makkah'],
  ['Makkah', 'Makkah'],
  ['Madinah', 'Madinah'],
  ['Dammam', 'Eastern Province'],
  ['Khobar', 'Eastern Province'],
  ['Dhahran', 'Eastern Province'],
  ['Taif', 'Makkah'],
  ['Abha', 'Asir'],
  ['Tabuk', 'Tabuk'],
  ['Buraidah', 'Qassim'],
  ['Hail', 'Hail'],
  ['Najran', 'Najran'],
  ['Jazan', 'Jazan'],
]

function buildRow({
  city,
  region,
  tier,
  priority,
}: {
  city: string
  region: string
  tier: RateTier
  priority: number
}) {
  return {
    zoneName: region,
    country: 'Saudi Arabia',
    region,
    city,
    carrier: 'SMSA',
    serviceName: tier.serviceName,
    baseRate: tier.baseRate,
    includedWeightKg: 1,
    extraPerKg: 5,
    weightRoundingKg: 1,
    freeShippingEnabled: tier.freeShippingEnabled,
    freeShippingMinPrice: 0,
    codFee: 10,
    remoteSurcharge: 0,
    etaMinDays: tier.etaMinDays,
    etaMaxDays: tier.etaMaxDays,
    pickupAvailable: true,
    codAvailable: true,
    isActive: true,
    priority,
  }
}

/** Seed SMSA flat per-city defaults until the commercial rate card arrives. */
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing')

  await mongoose.connect(uri)
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'
  const existing = await ShippingRate.countDocuments()
  if (existing > 0 && !process.argv.includes('--force')) {
    console.log(
      `Shipping rates already exist (${existing}); nothing to seed. Use --force to replace them.`
    )
    return
  }

  const rows = cities.flatMap(([city, region]) => {
    const tiers = city === 'Riyadh' ? riyadhTiers : outsideRiyadhTiers
    return tiers.map((tier) =>
      buildRow({ city, region, tier, priority: 10 })
    )
  })

  // Country/region fallback for any city without its own row.
  rows.push(
    ...outsideRiyadhTiers.map((tier) =>
      buildRow({
        city: '*',
        region: '*',
        tier: {
          ...tier,
          baseRate: tier.baseRate + 5,
        },
        priority: 0,
      })
    )
  )

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
