import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import {
  absoluteSiteUrl,
  pageSeoUrls,
  resolveOgImage,
} from '../lib/seo-url'

const saved = new Map<string, string | undefined>()

beforeEach(() => {
  saved.set('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL)
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.essentialvital.com/'
})

afterEach(() => {
  const value = saved.get('NEXT_PUBLIC_SITE_URL')
  if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = value
})

test('seo: the default locale is unprefixed and the canonical is self-referencing', () => {
  const home = pageSeoUrls('en-US', '/')
  assert.equal(home.canonical, 'https://www.essentialvital.com/')

  const product = pageSeoUrls('en-US', '/product/gift-card')
  assert.equal(
    product.canonical,
    'https://www.essentialvital.com/product/gift-card'
  )
})

test('seo: other locales are prefixed and all languages are emitted', () => {
  const product = pageSeoUrls('fr', '/product/gift-card')
  assert.equal(
    product.canonical,
    'https://www.essentialvital.com/fr/product/gift-card'
  )
  assert.equal(
    product.languages['en-US'],
    'https://www.essentialvital.com/product/gift-card'
  )
  assert.equal(
    product.languages.fr,
    'https://www.essentialvital.com/fr/product/gift-card'
  )
  assert.equal(
    product.languages.ar,
    'https://www.essentialvital.com/ar/product/gift-card'
  )
})

test('seo: the missing legacy OG image falls back to the generated one', () => {
  assert.equal(resolveOgImage('/og-preview.jpg'), '/opengraph-image.png')
  assert.equal(resolveOgImage(undefined), '/opengraph-image.png')
  assert.equal(resolveOgImage('/images/banner1.jpg'), '/images/banner1.jpg')
})

test('seo: image URLs are made absolute once', () => {
  assert.equal(
    absoluteSiteUrl('https://www.essentialvital.com', '/images/a.jpg'),
    'https://www.essentialvital.com/images/a.jpg'
  )
  assert.equal(
    absoluteSiteUrl('https://www.essentialvital.com', 'https://cdn.example/a.jpg'),
    'https://cdn.example/a.jpg'
  )
})
