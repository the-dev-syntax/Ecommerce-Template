// Session revocation must run in both Node (auth.ts) and the Edge
// (middleware/auth.config.ts). Use Upstash's REST API directly instead of the
// Node SDK so the Edge bundle does not pull in Node-only code.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// Must match the JWT session lifetime in auth.ts.
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const REVOKED_SESSION_PREFIX = 'v1:auth:revoked-session:'

export type SessionStore = {
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>
  get(key: string): Promise<unknown>
}

export function revokedSessionKey(sid: string): string {
  return `${REVOKED_SESSION_PREFIX}${sid}`
}

export type TokenVersionCheck = 'adopt' | 'valid' | 'revoked'

/**
 * Compare the version stored in a JWT with the current user document.
 * `adopt` handles tokens issued before tokenVersion existed.
 */
export function checkTokenVersion(
  tokenVersion: number | undefined,
  currentVersion: number | undefined
): TokenVersionCheck {
  if (tokenVersion === undefined) return 'adopt'
  return tokenVersion === (currentVersion ?? 0) ? 'valid' : 'revoked'
}

/**
 * TTL for a revocation entry: exactly the token's remaining lifetime, capped
 * at the session max age and never below one second.
 */
export function sessionRevocationTtl(
  expiresAtSeconds?: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): number {
  const expiresAt = expiresAtSeconds ?? nowSeconds + SESSION_MAX_AGE_SECONDS
  return Math.min(
    Math.max(1, Math.ceil(expiresAt - nowSeconds)),
    SESSION_MAX_AGE_SECONDS
  )
}

async function redisCommand<T>(
  command: (string | number)[]
): Promise<T | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null

  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`Redis request failed: ${response.status}`)

  const data = (await response.json()) as {
    result?: T | null
    error?: string
  }
  if (data.error) throw new Error(data.error)
  return data.result ?? null
}

const restStore: SessionStore = {
  async set(key, value, opts) {
    await redisCommand(['SET', key, value, 'EX', opts.ex])
  },
  async get(key) {
    return redisCommand(['GET', key])
  },
}

/**
 * Revoke one device/session by its stable `sid`. The Redis entry expires
 * exactly when the token itself would have expired, so the denylist stays
 * bounded and needs no cleanup job.
 */
export async function revokeSession(
  sid: string | undefined,
  expiresAtSeconds?: number,
  store: SessionStore = restStore
): Promise<void> {
  if (!sid) return

  try {
    await store.set(revokedSessionKey(sid), '1', {
      ex: sessionRevocationTtl(expiresAtSeconds),
    })
  } catch {
    // Fail open: tokenVersion and passwordChangedAt remain the hard boundary,
    // and an unreachable Redis must not take authentication down.
  }
}

/** Check whether a session was revoked before its token expired. */
export async function isSessionRevoked(
  sid: string | undefined,
  store: SessionStore = restStore
): Promise<boolean> {
  if (!sid) return false

  try {
    return (await store.get(revokedSessionKey(sid))) !== null
  } catch {
    // Fail open for the same reason as revokeSession.
    return false
  }
}
