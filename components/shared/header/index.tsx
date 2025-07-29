import { getAllCategories } from '@/lib/actions/product.actions'
import Image from 'next/image'
import Link from 'next/link'
import Menu from './menu'
// import { Button } from '@/components/ui/button'
// import { MenuIcon } from 'lucide-react'
import Sidebar from './sidebar'
import { getSetting } from '@/lib/actions/setting.actions'
import { getTranslations } from 'next-intl/server'
import data from '@/lib/data'
import Search from './search'
import { auth } from '@/auth'

export default async function Header() {
  const session = await auth()
  const { site } = await getSetting()
  const t = await getTranslations('Header')
  const categories = await getAllCategories()

  const visibleMenus = data.headerMenus.filter((menu) => {
   if (menu.name === 'Browsing History') {
    return !!session; // this will make it true or false
    }  
    return true;
  })

  return (
    <header className='bg-black  text-white'>
      <div className='px-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <Link
              href='/'
              className='flex items-center header-button font-bold text-2xl m-1 dark:text-orange-500 text-sky-500'
            >
              <Image
                src={site.logo}
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
          {visibleMenus.map((menu) => (         
            <Link
              href={menu.href}
              key={menu.href}
              className='header-button !p-2'
            >
              {t(menu.name)}
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}
/*
<Button
          variant='ghost'
          className='dark hover:bg-transparent  header-button flex items-center gap-1 text-base [&_svg]:size-6'
        >
          <MenuIcon />
          All
        </Button>
*/