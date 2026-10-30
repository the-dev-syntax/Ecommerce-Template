import type {
  Data,
  IProductInput,
  ISettingInput,
  IUserInput,
  IWebPageInput,
} from '@/types'
import { i18n } from '@/i18n-config'
import { normalizeSaudiPhone } from './phone'

/**
 * PRODUCTION SEED DATA TEMPLATE
 * =============================
 * `lib/data.ts` is the development seed (made-up users, products and demo
 * orders). This file is the production seed: fill the arrays with the real
 * catalogue and run `npm run check:production-data` before seeding.
 *
 * Rules for the real data:
 * - Every `TODO: ...` value must be replaced. The readiness guard rejects any
 *   remaining placeholder, so a half-filled file cannot be seeded by accident.
 * - Passwords are bcrypt hashes, never plaintext. Generate one with
 *   `ADMIN_PASSWORD=... npm run hash:password` and paste the hash.
 * - Product images must be real paths/URLs. Variants must use unique ids/SKUs
 *   and exactly one default variant per product.
 * - Prices are in the base currency (SAR) and must have two decimals.
 * - Seller/VAT/invoice values must match the ZATCA registration.
 * - Only list payment providers whose environment variables are configured.
 * - Seeded reviews are optional. Customer reviews are created from paid orders
 *   and go through the admin approval queue at runtime.
 *
 * `npm run seed` still uses `lib/data.ts`; `npm run seed:production` uses this
 * module, runs the readiness guard before deleting anything, and skips the
 * generated demo orders/reviews.
 */

const TODO = (label: string) => `TODO: ${label}`

const settings: ISettingInput[] = [
  {
    market: 'SA',
    brand: {
      logoDark: TODO('brand logo path'),
      favicon: TODO('favicon path'),
      emailLogo: TODO('email logo path'),
      primaryColor: '#eab308',
      accentColor: '#0ea5e9',
      fontFamily: 'cairo',
      socialLinks: [],
    },
    seo: {
      titleTemplate: `%s | ${TODO('store name')}`,
      defaultDescription: TODO('SEO default description'),
      ogImage: TODO('Open Graph image path'),
      twitterHandle: '',
    },
    features: {
      reviews: true,
      browsingHistory: true,
      cashOnDelivery: true,
    },
    navigation: {
      header: [
        { name: 'Shop', href: '/search' },
        { name: 'Best Sellers', href: '/search?tag=best-seller' },
        { name: 'New Arrivals', href: '/search?tag=new-arrival' },
        { name: 'About Us', href: '/page/about-us' },
        { name: 'Contact Us', href: '/page/contact-us' },
      ],
      footer: [
        {
          title: 'Customer Service',
          links: [
            { name: 'Contact Us', href: '/page/contact-us' },
            { name: 'Shipping', href: '/page/shipping' },
            { name: 'Returns', href: '/page/returns-policy' },
          ],
        },
        {
          title: 'Company',
          links: [
            { name: 'About Us', href: '/page/about-us' },
            { name: 'Privacy Policy', href: '/page/privacy-policy' },
            { name: 'Conditions of Use', href: '/page/conditions-of-use' },
          ],
        },
      ],
    },
    email: {
      senderName: TODO('sender name'),
      senderEmail: TODO('sender email'),
      replyTo: '',
    },
    emailTemplates: {
      receipt: {
        subject: 'Order confirmation',
        heading: 'Thank you for your order',
        intro:
          'We have received your order and will notify you when it ships.',
        footer: 'Thank you for shopping with us.',
      },
      review: {
        subject: 'Review your order items',
        heading: 'How was your order?',
        intro: 'Tell us what you think about the products you received.',
        footer: 'Your feedback helps other customers.',
      },
      reset: {
        subject: 'Reset your password',
        heading: 'Reset your password',
        intro:
          'We received a request to reset your password. Use the button below to choose a new one.',
        footer:
          'If you did not request this, you can safely ignore this email.',
      },
      verification: {
        subject: '{token} - Verify your email address',
        heading: 'Verify your email address',
        intro:
          'Thank you for signing up. Enter the verification code below to complete your registration.',
        footer:
          'If you did not request this email, you can safely ignore it.',
      },
    },
    seller: {
      legalNameEn: TODO('English legal name'),
      legalNameAr: TODO('Arabic legal name'),
      vatNumber: TODO('15-digit VAT number'),
      crNumber: TODO('commercial registration number'),
      nationalAddress: TODO('national address'),
      street: TODO('street'),
      buildingNumber: TODO('building number'),
      citySubdivision: TODO('district'),
      city: TODO('city'),
      postalCode: TODO('postal code'),
      country: 'SA',
      email: TODO('seller email'),
      phone: TODO('seller phone'),
    },
    invoice: {
      prefix: 'EV',
      sequenceLength: 6,
    },
    common: {
      freeShippingMinPrice: 0,
      isMaintenanceMode: false,
      defaultTheme: 'Light',
      defaultColor: 'Gold',
      pageSize: 12,
      taxRate: 0.15,
      taxInclusive: true,
    },
    site: {
      name: TODO('store name'),
      description: TODO('store description'),
      keywords: TODO('store keywords'),
      url: TODO('https://your-domain.example'),
      logo: TODO('store logo path'),
      slogan: TODO('store slogan'),
      author: TODO('store author'),
      copyright: TODO('copyright line'),
      email: TODO('store email'),
      address: TODO('store address'),
      phone: TODO('store phone'),
    },
    availableLanguages: i18n.locales.map((locale) => ({
      code: locale.code,
      name: locale.name,
    })),
    defaultLanguage: 'en-US',
    carousels: [
      {
        title: TODO('first carousel title'),
        buttonCaption: 'Shop now',
        image: TODO('first carousel image path'),
        url: '/search',
      },
    ],
    availableCurrencies: [
      {
        name: 'Saudi Riyal',
        code: 'SAR',
        symbol: 'ر.س',
        convertRate: 1,
        locale: 'en-US',
        decimals: 2,
        isBase: true,
      },
      {
        name: 'United States Dollar',
        code: 'USD',
        symbol: '$',
        convertRate: 0.2667,
        locale: 'en-US',
        decimals: 2,
        isBase: false,
      },
    ],
    defaultCurrency: 'SAR',
    availablePaymentMethods: [
      { name: 'Moyasar' },
      { name: 'Cash On Delivery' },
    ],
    defaultPaymentMethod: 'Moyasar',
    availableDeliveryDates: [
      {
        name: 'Express',
        daysToDeliver: 1,
        shippingPrice: 15,
        freeShippingMinPrice: 0,
      },
      {
        name: 'Standard',
        daysToDeliver: 3,
        shippingPrice: 8,
        freeShippingMinPrice: 200,
      },
    ],
    defaultDeliveryDate: 'Standard',
  },
]

/**
 * Copy this object into `users` and replace the placeholders.
 * The password must be a bcrypt hash, not plaintext.
 */
export const productionAdminTemplate: IUserInput = {
  name: TODO('admin name'),
  email: 'TODO: admin@example.com',
  password: 'REPLACE_WITH_A_BCRYPT_HASH',
  role: 'admin',
  emailVerified: null,
  paymentMethod: 'Cash On Delivery',
  address: {
    fullName: TODO('admin full name'),
    street: TODO('street'),
    city: 'Riyadh',
    province: 'Riyadh',
    postalCode: '12211',
    country: 'SA',
    phone: '+9665XXXXXXXX',
  },
}

/**
 * Copy this object into `products` and replace the placeholders. Remove
 * `variants` entirely for a product without size/colour variants; the seed
 * normalizer will create the default variant.
 */
export const productionProductTemplate: IProductInput = {
  name: TODO('product name'),
  slug: 'TODO-product-slug',
  category: TODO('category'),
  images: ['TODO: /images/product-primary.jpg'],
  brand: TODO('brand'),
  description: TODO('product description'),
  isPublished: false,
  taxCategory: 'S',
  exemptionReasonCode: undefined,
  returnPolicy: 'return_and_refund',
  price: 0,
  listPrice: 0,
  countInStock: 0,
  lowStockThreshold: 5,
  weight: 0,
  tags: [],
  sizes: ['M'],
  colors: [],
  variants: [
    {
      id: 'TODO-variant-id',
      sku: 'TODO-SKU',
      size: 'M',
      color: '',
      price: 0,
      listPrice: 0,
      countInStock: 0,
      image: 'TODO: /images/product-primary.jpg',
      barcode: '',
      weight: 0,
      isDefault: true,
    },
  ],
  avgRating: 0,
  numReviews: 0,
  ratingDistribution: [
    { rating: 1, count: 0 },
    { rating: 2, count: 0 },
    { rating: 3, count: 0 },
    { rating: 4, count: 0 },
    { rating: 5, count: 0 },
  ],
  reviews: [],
  numSales: 0,
}

/** Copy this object into `webPages` and replace the placeholders. */
export const productionWebPageTemplate: IWebPageInput = {
  title: TODO('page title'),
  slug: 'TODO-page-slug',
  content: TODO('page content (Markdown is supported)'),
  isPublished: true,
}

export const productionData: Data = {
  settings,
  // Replace with real staff/admin accounts. At least one admin is required.
  users: [],
  // Replace with the real catalogue.
  products: [],
  // Optional: seeded review rows are demo content. Real reviews come from paid
  // orders and wait for admin approval.
  reviews: [],
  // Replace with the real legal/support pages (about, contact, shipping,
  // returns, privacy, conditions of use, ...).
  webPages: [],
  // The storefront reads navigation from settings.navigation; these top-level
  // fields are kept for the shared Data type.
  headerMenus: [],
  carousels: [],
}

const PLACEHOLDER_PATTERN = /TODO:|REPLACE_WITH|CHANGEME/i
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/

function collectPlaceholders(
  value: unknown,
  path: string,
  found: string[]
): void {
  if (typeof value === 'string') {
    if (PLACEHOLDER_PATTERN.test(value)) found.push(path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectPlaceholders(entry, `${path}[${index}]`, found)
    )
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      collectPlaceholders(entry, `${path}.${key}`, found)
    }
  }
}

/**
 * Return human-readable reasons why the production seed is not ready. The
 * deployment run should refuse to seed while this list is non-empty.
 */
export function validateProductionData(data: Data = productionData): string[] {
  const problems: string[] = []

  collectPlaceholders(data, 'productionData', problems)

  if (data.settings.length !== 1) {
    problems.push('settings must contain exactly one store configuration')
  }

  const setting = data.settings[0]
  if (setting) {
    if (!setting.availableCurrencies.some((currency) => currency.isBase))
      problems.push('settings.availableCurrencies needs one base currency')
    if (
      !setting.availableCurrencies.some(
        (currency) => currency.code === setting.defaultCurrency
      )
    )
      problems.push('settings.defaultCurrency is not in availableCurrencies')
    if (
      !setting.availableLanguages.some(
        (language) => language.code === setting.defaultLanguage
      )
    )
      problems.push('settings.defaultLanguage is not in availableLanguages')
    if (
      !setting.availablePaymentMethods.some(
        (method) => method.name === setting.defaultPaymentMethod
      )
    )
      problems.push('settings.defaultPaymentMethod is not enabled')
    if (
      !setting.availableDeliveryDates.some(
        (date) => date.name === setting.defaultDeliveryDate
      )
    )
      problems.push('settings.defaultDeliveryDate is not available')
    if (setting.carousels.length === 0)
      problems.push('settings.carousels needs at least one slide')
  }

  if (!data.users.some((user) => user.role === 'admin'))
    problems.push('users needs at least one admin account')

  const seenEmails = new Set<string>()
  for (const [index, user] of data.users.entries()) {
    const label = `users[${index}]`
    const email = user.email.trim().toLowerCase()
    if (seenEmails.has(email)) problems.push(`${label}.email is duplicated`)
    seenEmails.add(email)
    if (!BCRYPT_PATTERN.test(user.password))
      problems.push(`${label}.password must be a bcrypt hash`)
    if (user.role === 'admin' && !user.emailVerified)
      problems.push(`${label}.emailVerified must be set for an admin`)
    if (!normalizeSaudiPhone(user.address.phone))
      problems.push(`${label}.address.phone must be a Saudi mobile number`)
  }

  if (data.products.length === 0)
    problems.push('products needs at least one real product')

  const seenSlugs = new Set<string>()
  const seenSkus = new Set<string>()
  for (const [index, product] of data.products.entries()) {
    const label = `products[${index}]`
    if (seenSlugs.has(product.slug))
      problems.push(`${label}.slug is duplicated`)
    seenSlugs.add(product.slug)
    if (product.images.length === 0)
      problems.push(`${label}.images needs at least one image`)
    if (product.price <= 0)
      problems.push(`${label}.price must be greater than zero`)
    if (product.variants?.length) {
      const defaults = product.variants.filter((variant) => variant.isDefault)
      if (defaults.length !== 1)
        problems.push(`${label}.variants needs exactly one default variant`)
      for (const variant of product.variants) {
        if (seenSkus.has(variant.sku))
          problems.push(`${label}.variants has a duplicate SKU: ${variant.sku}`)
        seenSkus.add(variant.sku)
        if (variant.price <= 0)
          problems.push(
            `${label}.variants[${variant.sku}].price must be greater than zero`
          )
      }
    }
  }

  const seenPageSlugs = new Set<string>()
  for (const [index, page] of data.webPages.entries()) {
    if (seenPageSlugs.has(page.slug))
      problems.push(`webPages[${index}].slug is duplicated`)
    seenPageSlugs.add(page.slug)
  }

  return problems
}

export function assertProductionDataReady(data: Data = productionData): void {
  const problems = validateProductionData(data)
  if (problems.length > 0) {
    throw new Error(
      `Production seed data is not ready:\n- ${problems.join('\n- ')}`
    )
  }
}

export default productionData
