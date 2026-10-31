/** Total report attempts before a submission becomes terminal. */
export const ZATCA_MAX_ATTEMPTS = 6

// Backoff after attempt 1..5. The sixth failed attempt becomes terminal.
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
]

export function zatcaRetryDelayMs(attempts: number): number | null {
  if (attempts >= ZATCA_MAX_ATTEMPTS) return null
  return RETRY_DELAYS_MS[attempts - 1] ?? null
}

export function nextZatcaRetryAt(
  attempts: number,
  now = new Date()
): Date | null {
  const delay = zatcaRetryDelayMs(attempts)
  return delay === null ? null : new Date(now.getTime() + delay)
}

export function isZatcaRetryDue(
  nextAttemptAt: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!nextAttemptAt) return true
  return new Date(nextAttemptAt).getTime() <= now.getTime()
}
