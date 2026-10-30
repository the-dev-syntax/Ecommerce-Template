import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatSaudiPhone,
  normalizeSaudiPhone,
  saudiPhoneNational,
} from '../lib/phone'

test('normalizeSaudiPhone: accepts every common Saudi format', () => {
  const expected = '+966551234567'
  for (const input of [
    '551234567',
    '0551234567',
    '966551234567',
    '00966551234567',
    '+966551234567',
    '+966 55 123 4567',
    '055 123 4567',
  ]) {
    assert.equal(normalizeSaudiPhone(input), expected, input)
  }
})

test('normalizeSaudiPhone: rejects non-Saudi / malformed numbers', () => {
  for (const input of [
    '',
    'x',
    '12345',
    '4181234567', // legacy Saudi landline style, not a mobile
    '2551234567', // does not start with 5
    '+15551234567',
    '+96655123456', // 8 national digits
    '+9665512345678', // 10 national digits
  ]) {
    assert.equal(normalizeSaudiPhone(input), null, input)
  }
})

test('saudiPhoneNational and formatSaudiPhone', () => {
  assert.equal(saudiPhoneNational('+966551234567'), '551234567')
  assert.equal(saudiPhoneNational('0551234567'), '551234567')
  assert.equal(saudiPhoneNational('nonsense'), null)
  assert.equal(formatSaudiPhone('0551234567'), '+966 551234567')
  assert.equal(formatSaudiPhone(''), '')
})
