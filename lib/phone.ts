export const SAUDI_PHONE_PREFIX = '+966'
// Saudi mobile: 5 followed by 8 digits (9 national digits).
const SAUDI_MOBILE_RE = /^5\d{8}$/

/**
 * Normalize a Saudi mobile number to E.164 (`+9665XXXXXXXX`).
 *
 * Accepts the formats Tawked accepts — `0551234567`, `551234567`,
 * `966551234567`, `00966551234567`, `+966551234567` — plus spaces/dashes/
 * parentheses. Returns `null` for anything that is not a Saudi mobile.
 */
export function normalizeSaudiPhone(input: string): string | null {
  if (typeof input !== 'string') return null

  let digits = input.replace(/[^\d]/g, '')
  if (!digits) return null

  if (digits.startsWith('00966')) digits = digits.slice(5)
  else if (digits.startsWith('966')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)

  if (!SAUDI_MOBILE_RE.test(digits)) return null
  return `${SAUDI_PHONE_PREFIX}${digits}`
}

/** The 9 national digits of a phone number, or `null` when invalid. */
export function saudiPhoneNational(input: string | null | undefined) {
  if (!input) return null
  const normalized = normalizeSaudiPhone(input)
  return normalized ? normalized.slice(SAUDI_PHONE_PREFIX.length) : null
}

/** Display form used in the UI: `+966 512345678`. */
export function formatSaudiPhone(input: string | null | undefined) {
  const national = saudiPhoneNational(input)
  return national ? `${SAUDI_PHONE_PREFIX} ${national}` : ''
}
