'use client'

import { ShoppingCartIcon } from 'lucide-react'
import Link from 'next/link'
import useIsMounted from '@/hooks/use-is-mounted'
import { cn } from '@/lib/utils'
import useCartStore from '@/hooks/use-cart-store'

export default function CartButton() {
  const isMounted = useIsMounted()

  const { cart: { items } } = useCartStore()

  const cartItemsCount = items.reduce((a, c) => a + c.quantity, 0)

  return (
    <Link href='/cart' className='px-1 header-button'>
      <div className='flex items-end text-xs relative'>
        <ShoppingCartIcon className='h-8 w-8' />

        {isMounted && (
          <span
            className={cn(
              `bg-black  px-1 rounded-full text-primary text-base font-bold absolute right-[30px] top-[-4px] z-10`,
              cartItemsCount >= 10 && 'text-sm px-0 p-[1px]'
            )}
          >
            {cartItemsCount}
          </span>
        )}
        <span className='font-bold'>Cart</span>
      </div>
    </Link>
  )
}

/* {isMounted && ( ... )}:
Crucial for avoiding hydration errors: This entire <span> (the badge) will only be rendered if isMounted is true.
Why? The cartItemsCount is derived from useCartStore. On the server during SSR, the cart store might be in its initial (empty) state or a state that doesn't match the client's persisted cart state (e.g., from localStorage). If the server renders a count of 0 and the client (after hydration and loading the persisted cart) renders a count of 5, you'd get a hydration mismatch error.
By waiting for isMounted to be true, we ensure the badge is only rendered on the client after the cart state has been properly initialized/loaded, thus matching what the client expects.

? steps : How it Works Together (Lifecycle)? :
* 1- Server-Side Rendering (SSR) / Initial Static Generation:
a- isMounted is false.
b- useCartStore might return an initial/empty cart state. cartItemsCount would be 0.
c- The Link, div, ShoppingCartIcon, and "Cart" text are rendered.
d- The count badge <span> is NOT rendered because isMounted is false.
* 2- Client-Side - Initial Render (before mount effect):
a- The browser receives the server-rendered HTML.
b- React starts to "hydrate" the HTML, attaching event listeners, etc.
c- isMounted is still false.
d- useCartStore might still be initializing or loading persisted state. 
        cartItemsCount could still be reflecting the initial server state or a quickly initialized client state.
e- The count badge <span> is still NOT rendered.
* 3- Client-Side - After Mount:
a- The component fully mounts to the DOM.
b- The useEffect inside useIsMounted runs, setting isMounted to true.
c- This causes the CartButton component to re-render.
d- useCartStore has now likely loaded the persisted cart state from localStorage (if zustand/middleware/persist is used). 
        cartItemsCount reflects the actual number of items in the client's cart.
e- Now, isMounted is true, so the count badge <span> IS rendered with the correct cartItemsCount.
* so:
This pattern ensures that the part of the UI that depends on client-side state (the cart count) is only rendered after that state is reliably available on the client, preventing hydration errors and ensuring UI consistency.

*/