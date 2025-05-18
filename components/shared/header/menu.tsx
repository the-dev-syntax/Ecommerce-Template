import CartButton from './cart-button'
import Link from 'next/link'

export default function Menu() {
  return (
    <div className='flex justify-end'>
      <nav className='flex gap-3 w-full'>
        <Link href='/signin' className='flex items-centerheader-button'>
          Hello, Sign in
        </Link>

        <CartButton />
      </nav>
    </div>
  )
}
