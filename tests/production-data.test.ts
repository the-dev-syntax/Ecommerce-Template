import assert from 'node:assert/strict'
import { test } from 'node:test'

import productionData, {
  productionAdminTemplate,
  productionProductTemplate,
  productionWebPageTemplate,
  validateProductionData,
} from '../lib/production-data'

// Replace every placeholder so the fixture resembles a filled production file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fill(value: any): any {
  if (typeof value === 'string' && /TODO:|REPLACE_WITH/.test(value))
    return 'Ready'
  if (Array.isArray(value)) return value.map(fill)
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = fill(value[key])
    return value
  }
  return value
}

function readyData() {
  const admin = fill(structuredClone(productionAdminTemplate))
  admin.email = 'admin@example.com'
  admin.password = '$2b$12$abcdefghijklmnopqrstuv'
  admin.emailVerified = new Date()
  admin.address.phone = '+966512345678'

  const product = fill(structuredClone(productionProductTemplate))
  product.slug = 'real-product'
  product.price = 10
  product.images = ['/images/real.jpg']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product.variants = product.variants.map((variant: any, index: number) => ({
    ...variant,
    sku: `SKU-${index + 1}`,
    price: 10,
    image: '/images/real.jpg',
  }))

  const page = fill(structuredClone(productionWebPageTemplate))
  page.slug = 'about-us'

  return {
    ...structuredClone(productionData),
    settings: fill(structuredClone(productionData.settings)),
    users: [admin],
    products: [product],
    webPages: [page],
  }
}

test('production data: the shipped template is intentionally incomplete', () => {
  const problems = validateProductionData(productionData)
  assert.ok(problems.length > 0)
  assert.ok(problems.some((problem) => problem.includes('users')))
  assert.ok(problems.some((problem) => problem.includes('products')))
})

test('production data: a filled file passes the readiness guard', () => {
  assert.deepEqual(validateProductionData(readyData()), [])
})

test('production data: duplicate slugs and missing base currency are rejected', () => {
  const data = readyData()
  data.products.push({ ...data.products[0] })
  data.settings[0].availableCurrencies = [
    { ...data.settings[0].availableCurrencies[0], isBase: false },
  ]

  const problems = validateProductionData(data)
  assert.ok(problems.some((problem) => problem.includes('slug is duplicated')))
  assert.ok(problems.some((problem) => problem.includes('base currency')))
})
