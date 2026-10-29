import ShippingRate from '@/lib/db/models/shipping-rate.model'
import { connectToDatabase } from '@/lib/db'
import { round2 } from '@/lib/utils'

// Active rates change rarely (admin edits) but are read on every cart pricing
// call. A 60-second in-process cache removes that query from the hot path;
// admin writes clear it immediately on the instance that served the write.
const RATES_CACHE_TTL_MS = 60_000

async function loadActiveShippingRates() {
  await connectToDatabase()
  return ShippingRate.find({ isActive: true })
    .sort({ priority: -1, baseRate: 1, serviceName: 1 })
    .lean()
}

type ActiveShippingRate = Awaited<
  ReturnType<typeof loadActiveShippingRates>
>[number]

const globalForShippingRates = global as unknown as {
  activeShippingRates?: { at: number; rates: ActiveShippingRate[] }
}

async function getActiveShippingRates(): Promise<ActiveShippingRate[]> {
  const cached = globalForShippingRates.activeShippingRates
  if (cached && Date.now() - cached.at < RATES_CACHE_TTL_MS)
    return cached.rates

  const rates = await loadActiveShippingRates()
  globalForShippingRates.activeShippingRates = { at: Date.now(), rates }
  return rates
}

/** Drop the cached rate list after an admin create/update/delete. */
export function clearShippingRatesCache() {
  globalForShippingRates.activeShippingRates = undefined
}

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
  codAvailable: boolean
  freeShippingEnabled: boolean
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

export function resolveFreeShippingMinPrice(
  rate: { freeShippingEnabled?: boolean; freeShippingMinPrice: number },
  storeFreeShippingMinPrice = 0
) {
  if (rate.freeShippingEnabled === false) return 0
  if (rate.freeShippingMinPrice > 0) return rate.freeShippingMinPrice
  return storeFreeShippingMinPrice > 0 ? storeFreeShippingMinPrice : 0
}

export function calculateShippingPrice(
  rate: {
    baseRate: number
    includedWeightKg: number
    extraPerKg: number
    weightRoundingKg: number
    freeShippingEnabled?: boolean
    freeShippingMinPrice: number
    remoteSurcharge: number
  },
  weight: number,
  itemsPrice: number
) {
  if (
    rate.freeShippingEnabled !== false &&
    rate.freeShippingMinPrice > 0 &&
    itemsPrice >= rate.freeShippingMinPrice
  ) {
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
  freeShippingMinPrice?: number
  pickupLocation?: string
}): Promise<ShippingQuote[]> {
  const rates = await getActiveShippingRates()

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

  const quotes: ShippingQuote[] = bestRates.map((rate) => {
    const freeShippingEnabled = rate.freeShippingEnabled !== false
    const freeShippingMinPrice = resolveFreeShippingMinPrice(
      rate,
      input.freeShippingMinPrice
    )

    return {
      id: String(rate._id),
      name: `${rate.carrier} ${rate.serviceName}`,
      zoneName: rate.zoneName,
      carrier: rate.carrier,
      serviceName: rate.serviceName,
      shippingPrice: calculateShippingPrice(
        { ...rate, freeShippingEnabled, freeShippingMinPrice },
        weight,
        input.itemsPrice
      ),
      etaMinDays: rate.etaMinDays,
      etaMaxDays: rate.etaMaxDays,
      isPickup: false,
      codFee: rate.codFee,
      codAvailable: rate.codAvailable !== false,
      freeShippingEnabled,
      freeShippingMinPrice,
    }
  })

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
      codAvailable: true,
      freeShippingEnabled: false,
      freeShippingMinPrice: 0,
    })
  }

  return quotes
}

/**
 * True when the store has at least one active shipping rule. Used to decide
 * whether an address with no matching quote should be rejected (configured
 * zones) or fall back to the legacy global delivery dates (no rules at all).
 */
export async function hasActiveShippingRates(): Promise<boolean> {
  return (await getActiveShippingRates()).length > 0
}
