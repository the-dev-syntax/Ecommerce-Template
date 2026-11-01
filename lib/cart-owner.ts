export type CartOwnerAction = 'keep' | 'claim' | 'clear'

/**
 * Decide what to do with the persisted cart when the resolved owner changes.
 *
 * - same owner                    -> keep
 * - guest -> signed-in            -> claim (cart survives the sign-in round-trip)
 * - different account / sign-out  -> clear (never leak a previous customer's cart)
 */
export function resolveCartOwnerAction(
  currentOwner: string | undefined,
  nextOwner: string | undefined
): CartOwnerAction {
  if (currentOwner === nextOwner) return 'keep'
  if (!currentOwner && nextOwner) return 'claim'
  return 'clear'
}
