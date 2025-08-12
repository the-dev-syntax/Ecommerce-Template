
export const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
export const SENDER_NAME = process.env.SENDER_NAME || 'Essential Vital'


export const USER_ROLES = ['admin', 'user']
export const COLORS = ['Gold', 'Green', 'Red']
export const THEMES = ['Light', 'Dark', 'System']

export const SORT_ORDERS  = [
  { value: 'price-low-to-high', name: 'Price: Low to high' },
  { value: 'price-high-to-low', name: 'Price: High to low' },
  { value: 'newest-arrivals', name: 'Newest arrivals' },
  { value: 'avg-customer-review', name: 'Avg. customer review' },
  { value: 'best-selling', name: 'Best selling' },
]
export const PRICE_RANGES = [
  { name: '$1 to $20', value: '1-20' },
  { name: '$21 to $50', value: '21-50' },
  { name: '$51 to $1000', value: '51-1000' },
]


