/**
 * Extract a client IP from proxy headers. Kept free of Redis/Next imports so
 * it can be unit-tested and reused by server actions and route handlers.
 */
export function pickClientIp(
  getHeader: (name: string) => string | null,
  configuredHeader?: string
): string | null {
  // Only trust a header that the deployment's edge/proxy sets (or overwrites).
  // The left-most X-Forwarded-For entry is client-controlled: anyone can
  // prepend an arbitrary address there, which defeats every rate limiter.
  // Set TRUSTED_IP_HEADER when the deployment uses a proxy/header this code
  // does not know about (e.g. cf-connecting-ip).
  const candidates = [
    configuredHeader?.trim().toLowerCase(),
    'x-vercel-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
  ].filter(Boolean) as string[]

  for (const headerName of candidates) {
    const value = getHeader(headerName)
    if (!value) continue
    // A proxy can append to a forwarded chain. The right-most entry is the one
    // the nearest proxy added, so a client-supplied left-most value can never
    // win. Vercel overwrites these headers with a single address (verified
    // 2026-10-31), so this is also correct there.
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }

  const forwardedFor = getHeader('x-forwarded-for')
  if (forwardedFor) {
    // The right-most value is the one added by the nearest proxy; without an
    // explicit TRUSTED_IP_HEADER this is the safest available fallback.
    const parts = forwardedFor
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }

  return null
}
