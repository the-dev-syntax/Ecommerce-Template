import ShippingRate from '@/lib/db/models/shipping-rate.model'
import { connectToDatabase } from '@/lib/db'
import { round2 } from '@/lib/utils'

export interface ShippingItem {
  quantity: number
  weight?: number
}

export interface ShippingQuote {
  id: string
  name: string
  zoneName: string
  carrier: string
  serviceName: string
  shippingPrice: number
  etaMinDays: number
  etaMaxDays: number
  isPickup: boolean
  pickupLocation?: string
  codFee: number
  freeShippingMinPrice: number
}

function normalizeCountry(value: string) {
  const country = value.trim().toLowerCase()
  return ['sa', 'ksa', 'saudi', 'saudi arabia', 'المملكة العربية السعودية'].includes(
    country
  )
    ? 'saudi arabia'
    : country
}

export function shippingLocationMatches(value: string, target: string) {
  return target === '*' || value.trim().toLowerCase() === target.trim().toLowerCase()
}

export function shippingCountryMatches(value: string, target: string) {
  return (
    target === '*' ||
    normalizeCountry(value) === normalizeCountry(target)
  )
}

export function calculateShippingPrice(
  rate: {
    baseRate: number
    includedWeightKg: number
    extraPerKg: number
    weightRoundingKg: number
    freeShippingMinPrice: number
    remoteSurcharge: number
  },
  weight: number,
  itemsPrice: number
) {
  if (rate.freeShippingMinPrice > 0 && itemsPrice >= rate.freeShippingMinPrice) {
    return 0
  }
  const rounding = rate.weightRoundingKg > 0 ? rate.weightRoundingKg : 1
  const billableWeight = Math.max(
    0,
    Math.ceil(weight / rounding) * rounding
  )
  const extraWeight = Math.max(0, billableWeight - rate.includedWeightKg)
  return round2(
    rate.baseRate + extraWeight * rate.extraPerKg + rate.remoteSurcharge
  )
}

export async function getShippingRates(input: {
  country: string
  region: string
  city: string
  items: ShippingItem[]
  itemsPrice: number
  pickupLocation?: string
}): Promise<ShippingQuote[]> {
  await connectToDatabase()
  const rates = await ShippingRate.find({ isActive: true })
    .sort({ priority: -1, baseRate: 1 })
    .lean()

  const matched = rates
    .filter(
      (rate) =>
        shippingCountryMatches(input.country, rate.country) &&
        shippingLocationMatches(input.region, rate.region) &&
        shippingLocationMatches(input.city, rate.city)
    )
    .sort((a, b) => {
      const specificity = (rate: typeof a) =>
        (rate.city !== '*' ? 2 : 0) + (rate.region !== '*' ? 1 : 0)
      return specificity(b) - specificity(a) || b.priority - a.priority
    })

  const bestSpecificity = matched.reduce(
    (best, rate) =>
      Math.max(
        best,
        (rate.city !== '*' ? 2 : 0) + (rate.region !== '*' ? 1 : 0)
      ),
    -1
  )
  const bestRates = matched.filter(
    (rate) =>
      (rate.city !== '*' ? 2 : 0) + (rate.region !== '*' ? 1 : 0) ===
      bestSpecificity
  )

  const weight = input.items.reduce(
    (total, item) => total + (item.weight ?? 0) * item.quantity,
    0
  )

  const quotes: ShippingQuote[] = bestRates.map((rate) => ({
    id: String(rate._id),
    name: `${rate.carrier} ${rate.serviceName}`,
    zoneName: rate.zoneName,
    carrier: rate.carrier,
    serviceName: rate.serviceName,
    shippingPrice: calculateShippingPrice(rate, weight, input.itemsPrice),
    etaMinDays: rate.etaMinDays,
    etaMaxDays: rate.etaMaxDays,
    isPickup: false,
    codFee: rate.codFee,
    freeShippingMinPrice: rate.freeShippingMinPrice,
  }))

  if (bestRates.some((rate) => rate.pickupAvailable)) {
    quotes.push({
      id: 'pickup',
      name: 'Pickup from store',
      zoneName: 'Pickup',
      carrier: 'Store',
      serviceName: 'Pickup',
      shippingPrice: 0,
      etaMinDays: 0,
      etaMaxDays: 0,
      isPickup: true,
      pickupLocation: input.pickupLocation,
      codFee: 0,
      freeShippingMinPrice: 0,
    })
  }

  return quotes
}
