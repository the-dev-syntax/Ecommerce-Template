'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const links = [
  {
    title: 'Setup',
    href: '/admin/setup',
  },
  {
    title: 'Overview',
    href: '/admin/overview',
  },
  {
    title: 'Products',
    href: '/admin/products',
  },
  {
    title: 'Orders',
    href: '/admin/orders',
  },
  {
    title: 'Users',
    href: '/admin/users',
  },
  {
    title: 'Pages',
    href: '/admin/web-pages',
  },
  {
    title: 'Carousel',
    href: '/admin/carousels',
  },
  {
    title: 'Settings',
    href: '/admin/settings',
  },
]

export function AdminNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()
  const t = useTranslations()

  return (
    <nav
      className={cn(
        'flex items-center flex-wrap overflow-hidden gap-2 md:gap-4',
        className
      )}
      {...props}
    >
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'transition-colors hover:text-sky-400 active:text-white active:opacity-70',
             pathname.includes(item.href) ? 'text-sky-400' : 'text-muted-foreground'
          )}
        >
          {t(item.title)}
        </Link>
      ))}
    </nav>
  )
}