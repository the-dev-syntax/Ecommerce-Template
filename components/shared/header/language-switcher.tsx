'use client'

import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import useSettingStore from '@/hooks/use-setting-store'
import { i18n } from '@/i18n-config'
import { setCurrencyOnServer } from '@/lib/actions/setting.actions'
import { ChevronDownIcon } from 'lucide-react'

export default function LanguageSwitcher() {
  const t = useTranslations('Header')
  const { locales } = i18n
  const locale = useLocale()
  const pathname = usePathname()
// availableCurrencies: from data.ts, currency: added to setting in useSettingStore but its value is the default currency from data.ts
  const {
    setting: { availableCurrencies, currency },
    setCurrency,
} = useSettingStore()
// update the server , update the setting store.
  const handleCurrencyChange = async (newCurrency: string) => {
    await setCurrencyOnServer(newCurrency)
    setCurrency(newCurrency)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='header-button h-[41px]'  aria-label={t('Select language and currency')}>
        <div className='flex items-center gap-1'>
          <span className='text-lg mt-[-4px]'>
            {locales.find((l) => l.code === locale)?.icon}
          </span>
          <span className='text-primary'>
            {locale.toUpperCase().slice(0, 2)}
            </span>
          <ChevronDownIcon />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56'>
        <DropdownMenuLabel>{t('Language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale}>
          {locales.map((c) => (
            <DropdownMenuRadioItem key={c.name} value={c.code}>
              <Link
                className='w-full flex items-center gap-1'
                href={pathname}
                locale={c.code}
              >
                <span className='text-lg'>{c.icon}</span> {c.name}
              </Link>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t('Currency')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={currency}
          onValueChange={handleCurrencyChange}
        >
          {availableCurrencies.map((c) => (
            <DropdownMenuRadioItem key={c.name} value={c.code}>
              {c.symbol} {c.code}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}