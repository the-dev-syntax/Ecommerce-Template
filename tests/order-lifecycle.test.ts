import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveOrderStatus, statusHistoryEntry } from '../lib/orders/status'
import { manualShippingProvider } from '../lib/shipping'

describe('order lifecycle', () => {
  it('derives a status for legacy orders', () => {
    assert.equal(
      deriveOrderStatus({ isPaid: false } as never),
      'pending_payment'
    )
    assert.equal(deriveOrderStatus({ isPaid: true } as never), 'paid')
    assert.equal(
      deriveOrderStatus({ isPaid: true, isDelivered: true } as never),
      'delivered'
    )
  })

  it('creates a timestamped history entry', () => {
    const entry = statusHistoryEntry('shipped', 'Tracking 123')
    assert.equal(entry.status, 'shipped')
    assert.ok(entry.at instanceof Date)
    assert.equal(entry.note, 'Tracking 123')
  })
})

describe('manual shipping provider', () => {
  it('creates a tracking shipment', async () => {
    const shipment = await manualShippingProvider.createShipment({
      orderId: 'order-1',
      trackingNumber: 'TRACK-1',
      trackingUrl: 'https://carrier.example/TRACK-1',
    })
    assert.equal(shipment.provider, 'manual')
    assert.equal(shipment.trackingNumber, 'TRACK-1')
    assert.equal(shipment.status, 'in_transit')
  })
})
