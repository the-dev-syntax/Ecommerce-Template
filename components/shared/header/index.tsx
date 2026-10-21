import { getAllCategories } from '@/lib/actions/product.actions'
import Image from 'next/image'
import Link from 'next/link'
import Menu from './menu'
import Sidebar from './sidebar'
import { getSetting } from '@/lib/actions/setting.actions'
import Search from './search'
import { auth } from '@/auth'
import HeaderMenuLinks from './menu-links'
import { Suspense } from 'react'


export default async function Header() {
  const session = await auth()
  const { site, brand, features, navigation } = await getSetting()
  const categories = await getAllCategories()

  const visibleMenus = navigation.header.filter((menu) => {
    if (menu.href.includes('browsing-history')) {
      return features.browsingHistory && !!session
    }
    return true
  })
  const logoSrc = brand.logoDark || site.logo

  return (
    <header className='bg-black  text-white'>
      <div className='px-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <Link
              href='/'
              className='flex items-center header-button font-bold text-2xl m-1 text-primary'
            >
              <Image
                src={logoSrc}
                width={40}
                height={40}
                alt={`${site.name} logo`}
              />
              {site.name}
            </Link>
          </div>
          <div className='hidden md:block flex-1 max-w-xl'>
            <Search />
          </div>
          <Menu />
        </div>
        <div className='md:hidden block py-2'>
          <Search />
        </div>
      </div>
      
      <div className='flex items-center px-3 mb-[1px]  bg-gray-800'>
      <Sidebar categories={categories} />
        <div className='flex items-center flex-wrap gap-3 overflow-hidden   max-h-[42px]'>
          <Suspense fallback={null}>
            <HeaderMenuLinks menus={visibleMenus} />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
