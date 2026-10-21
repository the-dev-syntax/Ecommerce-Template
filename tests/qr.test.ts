import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildZatcaQrPayload } from '../lib/invoices/qr'

function decodeTlv(payload: string) {
  const buffer = Buffer.from(payload, 'base64')
  const tags = new Map<number, string>()
  let offset = 0

  while (offset < buffer.length) {
    const tag = buffer[offset]
    const length = buffer[offset + 1]
    const value = buffer.subarray(offset + 2, offset + 2 + length).toString('utf8')
    tags.set(tag, value)
    offset += 2 + length
  }

  return tags
}

describe('buildZatcaQrPayload', () => {
  it('encodes the five Phase 1 TLV tags as base64', () => {
    const issuedAt = new Date('2026-10-20T12:34:56.000Z')
    const payload = buildZatcaQrPayload({
      sellerName: 'صيدلية نقاء الصحة الطبية',
      vatNumber: '310161142300003',
      issuedAt,
      total: 125,
      vatAmount: 15,
    })

    const tags = decodeTlv(payload)
    assert.equal(tags.get(1), 'صيدلية نقاء الصحة الطبية')
    assert.equal(tags.get(2), '310161142300003')
    assert.equal(tags.get(3), issuedAt.toISOString())
    assert.equal(tags.get(4), '125.00')
    assert.equal(tags.get(5), '15.00')
  })

  it('uses UTF-8 byte lengths for Arabic seller names', () => {
    const payload = buildZatcaQrPayload({
      sellerName: 'صيدلية',
      vatNumber: '310161142300003',
      issuedAt: new Date(),
      total: 1,
      vatAmount: 0,
    })

    assert.equal(decodeTlv(payload).get(1), 'صيدلية')
  })
})
