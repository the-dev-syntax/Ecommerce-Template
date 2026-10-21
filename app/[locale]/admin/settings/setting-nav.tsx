'use client'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  Currency,
  ImageIcon,
  Info,
  Languages,
  Mail,
  Menu as MenuIcon,
  Package,
  Palette,
  ReceiptText,
  Search as SearchIcon,
  SettingsIcon,
  ToggleLeft,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'


export default function SettingNav() {

  const t = useTranslations()  

  const [active, setActive] = useState('')

  useEffect(() => {
    const sections = document.querySelectorAll('div[id^="setting-"]')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        })
      },
      { threshold: 0.6, rootMargin: '0px 0px -40% 0px' }
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const handleScroll = (id: string) => {
    const section = document.getElementById(id)
    if (section) {
      const top = section.offsetTop - 16 // 20px above the section
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }
  // hash = id
  return (
    <div>
      <h1 className='h1-bold'>{t('Settings')}</h1>
      <nav className='flex md:flex-col gap-2 md:fixed mt-4 flex-wrap'>
        {[
          { name: 'Site Info', 
            hash: 'setting-site-info', 
            icon: <Info /> },
          {
            name: 'Brand and Theme',
            hash: 'setting-brand',
            icon: <Palette />,
          },
          {
            name: 'SEO Defaults',
            hash: 'setting-seo',
            icon: <SearchIcon />,
          },
          {
            name: 'Seller and Tax',
            hash: 'setting-seller',
            icon: <ReceiptText />,
          },
          {
            name: 'Feature Flags',
            hash: 'setting-features',
            icon: <ToggleLeft />,
          },
          {
            name: 'Navigation and Footer',
            hash: 'setting-navigation',
            icon: <MenuIcon />,
          },
          {
            name: 'Email Identity',
            hash: 'setting-email',
            icon: <Mail />,
          },
          {
            name: 'Email Templates',
            hash: 'setting-email-templates',
            icon: <Mail />,
          },
          {
            name: 'Common Settings',
            hash: 'setting-common',
            icon: <SettingsIcon />,
          },
          {
            name: 'Carousels',
            hash: 'setting-carousels',
            icon: <ImageIcon />,
          },
          { name: 'Languages',
            hash: 'setting-languages', 
            icon: <Languages /> },
          {
            name: 'Currencies',
            hash: 'setting-currencies',
            icon: <Currency />,
          },
          {
            name: 'Payment Methods',
            hash: 'setting-payment-methods',
            icon: <CreditCard />,
          },
          {
            name: 'Delivery Dates',
            hash: 'setting-delivery-dates',
            icon: <Package />,
          },
        ].map((item) => (
          <Button
            onClick={() => handleScroll(item.hash)}
            key={item.hash}
            variant={active === item.hash ? 'outline' : 'ghost'}
            className={`justify-start ${
              active === item.hash ? '' : 'border border-transparent'
            }`}
          >
            {item.icon}
            {t(item.name)}
          </Button>
        ))}
      </nav>
    </div>
  )
}

