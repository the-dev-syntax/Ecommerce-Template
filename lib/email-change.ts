type PendingEmailUser = {
  pendingEmail?: string | null
  pendingEmailExpires?: Date | string | null
}

/**
 * A verified account can still open /verify-email when an email change is
 * pending. Without this, the page redirected every verified user home and the
 * OTP form was unreachable.
 */
export function hasPendingEmailChange(
  user: PendingEmailUser | null | undefined,
  now = new Date()
): boolean {
  if (!user?.pendingEmail || !user.pendingEmailExpires) return false
  return new Date(user.pendingEmailExpires).getTime() > now.getTime()
}
