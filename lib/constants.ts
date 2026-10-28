
export const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
export const SENDER_NAME = process.env.SENDER_NAME || 'Essential Vital'


export const USER_ROLES = ['admin', 'user']
export const COLORS = ['Gold', 'Green', 'Red']
export const THEMES = ['Light', 'Dark', 'System']
export const FONT_OPTIONS = [
  { value: 'geist', name: 'Geist' },
  { value: 'cairo', name: 'Cairo' },
  { value: 'system', name: 'System' },
  { value: 'serif', name: 'Serif' },
]

export const SORT_ORDERS  = [
  { value: 'price-low-to-high', name: 'Price: Low to high' },
  { value: 'price-high-to-low', name: 'Price: High to low' },
  { value: 'newest-arrivals', name: 'Newest arrivals' },
  { value: 'avg-customer-review', name: 'Avg. customer review' },
  { value: 'best-selling', name: 'Best selling' },
]
export const PRODUCT_SORT_VALUES = SORT_ORDERS.map((order) => order.value)
// The value used when a URL carries an unknown/missing sort option.
export const DEFAULT_PRODUCT_SORT = 'best-selling'
// Whitelisted sort -> Mongo sort document. Unknown values never reach the
// database, so `?sort=<garbage>` cannot change the query shape.
export const PRODUCT_SORT_QUERY: Record<string, Record<string, 1 | -1>> = {
  'best-selling': { numSales: -1 },
  'price-low-to-high': { price: 1 },
  'price-high-to-low': { price: -1 },
  'avg-customer-review': { avgRating: -1 },
  'newest-arrivals': { createdAt: -1 },
}

/** True when a value from the URL is a supported sort option. */
export function isProductSort(value?: string | null): value is string {
  return !!value && PRODUCT_SORT_VALUES.includes(value)
}
export const PRICE_RANGES = [
  { name: '$1 to $20', value: '1-20' },
  { name: '$21 to $50', value: '21-50' },
  { name: '$51 to $1000', value: '51-1000' },
]

export const EMAIL_EXPIRATION_TIME = 3 * 60 * 1000;
export const PASSWORD_RESET_EXPIRATION_TIME = 30 * 60 * 1000;
// Per-account OTP protection (independent of the IP-based limiter).
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_LOCKOUT_TIME = 15 * 60 * 1000;

export const MAX_BROWSING_HISTORY = 50;
export const DATE_RANGE_KEY = 'admin-overview-date-range'