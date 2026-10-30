import 'server-only'

import { connectToDatabase } from './db'
import RevokedSession from './db/models/revoked-session.model'
import { sessionRevocationTtl } from './session-revocation'

/**
 * Node-side session denylist used together with Redis. Auth.js `signOut` runs
 * in Node, so writing both stores means a revocation still takes effect if one
 * store is unavailable when the user signs out.
 */
export async function persistRevokedSession(
  sid: string | undefined,
  expiresAtSeconds?: number
): Promise<void> {
  if (!sid) return

  await connectToDatabase()
  const expiresAt = new Date(
    Date.now() + sessionRevocationTtl(expiresAtSeconds) * 1000
  )
  await RevokedSession.updateOne(
    { sid },
    { $set: { expiresAt } },
    { upsert: true }
  )
}

/**
 * Check the database denylist. The Node JWT callback calls this even when the
 * Redis check reports "not revoked": a sign-out that happened while Redis was
 * down only wrote the database row, and Redis must not override it after it
 * recovers.
 */
export async function isSessionRevokedInDatabase(
  sid: string | undefined
): Promise<boolean> {
  if (!sid) return false

  await connectToDatabase()
  return !!(await RevokedSession.exists({
    sid,
    expiresAt: { $gt: new Date() },
  }))
}
