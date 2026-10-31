import assert from 'node:assert/strict'
import { test } from 'node:test'

import data from '../lib/data'
import { normalizeProductVariants } from '../lib/product-variants'
import {
  ProductInputSchema,
  SettingInputSchema,
  UserInputSchema,
  WebPageInputSchema,
} from '../lib/validator'

test('development seed data matches the current schemas', () => {
  assert.equal(data.settings.length, 1)
  SettingInputSchema.parse(data.settings[0])

  for (const user of data.users) UserInputSchema.parse(user)

  for (const product of data.products) {
    ProductInputSchema.parse(normalizeProductVariants(product))
  }

  for (const page of data.webPages) WebPageInputSchema.parse(page)

  assert.ok(data.users.length > 0)
  assert.ok(data.products.length > 0)
  // `Data` types users as IUserInput[]; the development seed intentionally
  // adds the later phone/address-book fields, so narrow the test-only view.
  const seedUsers = data.users as Array<
    (typeof data.users)[number] & {
      phone: string
      addresses: { isDefault?: boolean }[]
    }
  >
  assert.ok(
    seedUsers.every(
      (user) =>
        user.address.country === 'SA' &&
        user.phone.startsWith('+966') &&
        user.addresses.length >= 2
    )
  )
  assert.ok(
    data.products.every(
      (product) =>
        product.taxCategory &&
        product.returnPolicy &&
        typeof product.weight === 'number' &&
        (normalizeProductVariants(product).variants?.length ?? 0) > 0
    )
  )
})
