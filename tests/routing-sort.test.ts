import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEFAULT_PRODUCT_SORT, isProductSort } from '../lib/constants'
import { splitLocaleFromPathname } from '../lib/locale-path'
import { localizedPath } from '../lib/utils'

test('isProductSort: accepts only whitelisted values', () => {
  assert.equal(isProductSort('best-selling'), true)
  assert.equal(isProductSort('newest-arrivals'), true)
  assert.equal(isProductSort('price-low-to-high'), true)
  assert.equal(isProductSort('nonsense'), false)
  assert.equal(isProductSort(''), false)
  assert.equal(isProductSort(undefined), false)
  assert.equal(isProductSort(null), false)
})

test('DEFAULT_PRODUCT_SORT is itself a valid sort option', () => {
  assert.equal(isProductSort(DEFAULT_PRODUCT_SORT), true)
})

test('localizedPath: prefixes only non-default locales', () => {
  assert.equal(localizedPath('en-US', '/sign-in'), '/sign-in')
  assert.equal(localizedPath('ar', '/sign-in'), '/ar/sign-in')
  assert.equal(localizedPath('fr', '/product/x'), '/fr/product/x')
})

const locales = ['en-US', 'fr', 'ar']

test('splitLocaleFromPathname: matches the locale as an exact segment', () => {
  assert.deepEqual(splitLocaleFromPathname('/fr/account', locales, 'en-US'), {
    locale: 'fr',
    pathnameWithoutLocale: '/account',
  })
  assert.deepEqual(
    splitLocaleFromPathname('/en-US/product/x', locales, 'en-US'),
    { locale: 'en-US', pathnameWithoutLocale: '/product/x' }
  )
  assert.deepEqual(splitLocaleFromPathname('/ar', locales, 'en-US'), {
    locale: 'ar',
    pathnameWithoutLocale: '/',
  })
})

test('splitLocaleFromPathname: does not treat lookalike prefixes as locales', () => {
  assert.deepEqual(
    splitLocaleFromPathname('/friends-page', locales, 'en-US'),
    { locale: 'en-US', pathnameWithoutLocale: '/friends-page' }
  )
  assert.deepEqual(splitLocaleFromPathname('/archives', locales, 'en-US'), {
    locale: 'en-US',
    pathnameWithoutLocale: '/archives',
  })
  // A locale-looking segment later in the path is not a locale prefix.
  assert.deepEqual(
    splitLocaleFromPathname('/product/fr', locales, 'en-US'),
    { locale: 'en-US', pathnameWithoutLocale: '/product/fr' }
  )
})

test('splitLocaleFromPathname: normalizes locale casing', () => {
  assert.deepEqual(splitLocaleFromPathname('/FR/account', locales, 'en-US'), {
    locale: 'fr',
    pathnameWithoutLocale: '/account',
  })
})
