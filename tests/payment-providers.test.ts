import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getEnabledPaymentMethods,
  getPaymentProviderById,
  isPaymentProvider,
  paymentProviders,
} from '../lib/payments'

describe('payment provider registry', () => {
  it('matches providers by stored payment-method name', () => {
    assert.equal(isPaymentProvider('Moyasar', 'moyasar'), true)
    assert.equal(isPaymentProvider('Cash On Delivery', 'cod'), true)
    assert.equal(isPaymentProvider('Stripe', 'paypal'), false)
  })

  it('exposes refund and webhook capabilities', () => {
    assert.equal(getPaymentProviderById('moyasar')?.supportsRefunds, true)
    assert.equal(getPaymentProviderById('cod')?.supportsRefunds, false)
    assert.equal(
      getPaymentProviderById('moyasar')?.webhookPath,
      '/api/webhooks/moyasar'
    )
  })

  it('filters disabled COD and keeps unknown manual methods', () => {
    const methods = [
      { name: 'Cash On Delivery' },
      { name: 'Custom Manual' },
    ]
    assert.deepEqual(
      getEnabledPaymentMethods(methods, { cashOnDelivery: false }),
      [{ name: 'Custom Manual' }]
    )
  })

  it('registers a test-only mock provider', () => {
    assert.ok(paymentProviders.some((provider) => provider.id === 'mock'))
  })
})
