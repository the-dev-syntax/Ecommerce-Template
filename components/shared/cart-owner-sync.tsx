'use client'

import { useEffect } from 'react'

import useCartStore from '@/hooks/use-cart-store'

/**
 * Keeps the persisted cart tied to the signed-in account. Runs after hydration
 * so server and first client render stay identical, then claims or clears the
 * cart based on the session resolved by the server layout.
 */
export default function CartOwnerSync({
  ownerId,
}: {
  ownerId?: string
}) {
  const setCartOwner = useCartStore((state) => state.setCartOwner)

  useEffect(() => {
    setCartOwner(ownerId)
  }, [ownerId, setCartOwner])

  return null
}
