import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fillEmailTemplate } from '../lib/email-templates'

describe('fillEmailTemplate', () => {
  it('replaces supported placeholders', () => {
    assert.equal(
      fillEmailTemplate('{token} - welcome to {siteName}', {
        token: '123456',
        siteName: 'Test Store',
      }),
      '123456 - welcome to Test Store'
    )
  })

  it('leaves unknown placeholders empty', () => {
    assert.equal(fillEmailTemplate('Hello {name}', {}), 'Hello ')
  })
})
