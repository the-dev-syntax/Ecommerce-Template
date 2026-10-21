'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn, showLocaleRe } from '@/lib/utils'

type MenuItem = { name: string; href: string }

export default function HeaderMenuLinks({ menus }: { menus: MenuItem[] }) {
  const t = useTranslations()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const cleanPath = pathname.replace(showLocaleRe, '') || '/'

  const isActive = (href: string) => {
    const withoutHash = href.split('#')[0]
    const [path, query] = withoutHash.split('?')
    if (!path) return false // hash-only link, e.g. "#browsing-history"

    const pathMatches =
      path === '/'
        ? cleanPath === '/'
        : cleanPath === path || cleanPath.startsWith(path + '/')
    if (!pathMatches) return false

    if (query) {
      for (const [key, value] of new URLSearchParams(query).entries()) {
        if (searchParams.get(key) !== value) return false
      }
    }
    return true
  }

  return (
    <>
      {menus.map((menu) => (
        <Link
          key={menu.href}
          href={menu.href}
          className={cn('header-button !p-2', isActive(menu.href) && 'text-sky-400')}
        >
          {t.has(menu.name) ? t(menu.name) : menu.name}
        </Link>
      ))}
    </>
  )
}
