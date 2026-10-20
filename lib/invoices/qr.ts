/**
 * ZATCA simplified-invoice QR payload.
 *
 * TLV tags 1..5 are the minimum for a simplified tax invoice:
 * 1 seller name, 2 VAT number, 3 timestamp, 4 total incl. VAT, 5 VAT amount.
 * Length is the UTF-8 byte length, not the character count.
 */
function tlv(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, 'utf8')
  if (valueBuffer.length > 255)
    throw new Error(`QR TLV value for tag ${tag} is too long`)
  return Buffer.concat([Buffer.from([tag, valueBuffer.length]), valueBuffer])
}

export function formatZatcaTimestamp(date: Date): string {
  // ZATCA expects an ISO 8601 timestamp; UTC avoids ambiguous local offsets.
  return date.toISOString()
}

export function getZatcaYear(date: Date): string {
  const year = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: '2-digit',
  }).format(date)
  return year
}

export function buildZatcaQrPayload({
  sellerName,
  vatNumber,
  issuedAt,
  total,
  vatAmount,
}: {
  sellerName: string
  vatNumber: string
  issuedAt: Date
  total: number
  vatAmount: number
}): string {
  return Buffer.concat([
    tlv(1, sellerName),
    tlv(2, vatNumber),
    tlv(3, formatZatcaTimestamp(issuedAt)),
    tlv(4, total.toFixed(2)),
    tlv(5, vatAmount.toFixed(2)),
  ]).toString('base64')
}
