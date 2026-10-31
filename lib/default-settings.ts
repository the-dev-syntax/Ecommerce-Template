import type { ISettingInput } from '@/types'
import { i18n } from '@/i18n-config'

export const defaultSettings: ISettingInput[] = [
      {
      market: 'SA',
      brand: {
        logoDark: '/icons/EV_org-sky.svg',
        favicon: '/favicon.ico',
        emailLogo: '/icons/EV_org-sky.svg',
        primaryColor: '#eab308',
        accentColor: '#0ea5e9',
        fontFamily: 'geist',
        socialLinks: [
          { name: 'Instagram', url: 'https://instagram.com/essentialvital' },
          { name: 'X', url: 'https://x.com/essentialvital' },
          { name: 'WhatsApp', url: 'https://wa.me/966500000000' },
        ],
      },
      seo: {
        titleTemplate: '%s | Essential Vital',
        defaultDescription:
          'Discover premium, science-backed supplements designed to support your health and wellness goals.',
        ogImage: '/og-preview.jpg',
        twitterHandle: '',
      },
      features: {
        reviews: true,
        browsingHistory: true,
        cashOnDelivery: true,
      },
      navigation: {
        header: [
          { name: 'todaysDeals', href: '/search?tag=todays-deal' },
          { name: 'New Arrivals', href: '/search?tag=new-arrival' },
          { name: 'Featured Products', href: '/search?tag=featured' },
          { name: 'Best Sellers', href: '/search?tag=best-seller' },
          {
            name: 'Vitamins',
            href: `/search?category=${encodeURIComponent('Vitamins')}`,
          },
          {
            name: 'Supplements',
            href: `/search?category=${encodeURIComponent('Supplements')}`,
          },
          {
            name: 'Browsing History',
            href: '/account/browsing-history',
          },
        ],
        footer: [
          {
            title: 'Get to Know Us',
            links: [
              { name: 'Careers', href: '/page/careers' },
              { name: 'Blog', href: '/page/blog' },
              { name: 'About Us', href: '/page/about-us' },
            ],
          },
          {
            title: 'Make Money with Us',
            links: [
              { name: 'Sell products on', href: '/page/sell' },
              {
                name: 'Become an Affiliate',
                href: '/page/become-affiliate',
              },
              {
                name: 'Advertise Your Products',
                href: '/page/advertise',
              },
            ],
          },
          {
            title: 'Let Us Help You',
            links: [
              {
                name: 'Shipping Rates & Policies',
                href: '/page/shipping',
              },
              {
                name: 'Returns & Replacements',
                href: '/page/returns-policy',
              },
              { name: 'Help', href: '/page/help' },
            ],
          },
        ],
      },
      email: {
        senderName: 'Essential Vital',
        senderEmail: 'contact@EssentialVital.com',
        replyTo: '',
      },
      emailTemplates: {
        receipt: {
          subject: 'Order Confirmation',
          heading: 'Thank you for your order',
          intro:
            'We have received your order and will notify you when it ships.',
          footer: 'Thank you for shopping with us.',
        },
        review: {
          subject: 'Review your order items',
          heading: 'How was your order?',
          intro:
            'Tell us what you think about the products you received.',
          footer: 'Your feedback helps other customers.',
        },
        reset: {
          subject: 'Reset your password',
          heading: 'Reset your password',
          intro:
            'We received a request to reset your password. Use the button below to choose a new one.',
          footer: 'If you did not request this, you can safely ignore this email.',
        },
        verification: {
          subject: '{token} - Verify your email address',
          heading: 'Verify your email address',
          intro:
            'Thank you for signing up. Enter the verification code below to complete your registration.',
          footer:
            'If you did not request this email, you can safely ignore it.',
        },
      },
      seller: {
        legalNameEn: 'NAKAA ELSEHA MEDICAL PHARMACY',
        legalNameAr: 'صيدلية نقاء الصحة الطبية',
        vatNumber: '310161142300003',
        crNumber: '1185102259',
        nationalAddress: 'RFKB4744',
        street: 'King Fahd Road',
        buildingNumber: '1234',
        citySubdivision: 'Al Olaya',
        city: 'Riyadh',
        postalCode: '12211',
        country: 'SA',
        email: 'contact@EssentialVital.com',
        phone: '+1 (123) 456-7890',
      },
      invoice: {
        prefix: 'NEM',
        sequenceLength: 6,
      },
      common: {
        freeShippingMinPrice: 35,
        isMaintenanceMode: false,
        defaultTheme: 'Light',
        defaultColor: 'Gold',
        pageSize: 9,
        taxRate: 0.15,
        taxInclusive: true,
      },
      site: {
        name: 'Essential Vital',
        description:
          'Discover premium, science-backed supplements designed to support your health and wellness goals. Shop natural, high-quality vitamins, minerals, and herbal formulas for energy, immunity, and overall well-being.',
        keywords: 'Next Ecommerce, Next.js, Tailwind CSS, MongoDB',
        url: 'https://ev-web-zeta.vercel.app/',
        logo: '/icons/EV_org-sky.svg',
        slogan: 'Spend less, enjoy more.',
        author: 'Next Ecommerce',
        copyright: '2024-2025, EssentialVital.com, Inc. or its affiliates',
        email: 'contact@EssentialVital.com',
        address: '123, Main Street, Anytown, CA, Zip 12345',
        phone: '+1 (123) 456-7890',
      },
      carousels: [
        {
          title: 'Most Popular Shoes For Sale',
          buttonCaption: 'Shop Now',
          image: '/images/banner3.jpg',
          url: '/search?category=Shoes',
        },
        {
          title: 'Best Sellers in T-Shirts',
          buttonCaption: 'Shop Now',
          image: '/images/banner1.jpg',
          url: '/search?category=T-Shirts',
        },
        {
          title: 'Best Deals on Wrist Watches',
          buttonCaption: 'See More',
          image: '/images/banner2.jpg',
          url: '/search?category=Wrist Watches',
        },
      ],
      availableLanguages: i18n.locales.map((locale: { code: string; name: string }) => ({
        code: locale.code,
        name: locale.name,
      })),
      defaultLanguage: 'en-US',
      // SAR is the base currency; product prices are stored in SAR and the
      // other rates convert one SAR into the listed currency.
      availableCurrencies: [
        {
          name: 'Saudi Riyal',
          code: 'SAR',
          symbol: 'ر.س',
          convertRate: 1,
          locale: 'en-US',
          decimals: 2,
          isBase: true,
        },
        {
          name: 'United States Dollar',
          code: 'USD',
          symbol: '$',
          convertRate: 0.2667,
          locale: 'en-US',
          decimals: 2,
          isBase: false,
        },
        {
          name: 'Euro',
          code: 'EUR',
          symbol: '€',
          convertRate: 0.245,
          locale: 'en-US',
          decimals: 2,
          isBase: false,
        },
        {
          name: 'UAE Dirham',
          code: 'AED',
          symbol: 'AED',
          convertRate: 0.979,
          locale: 'en-US',
          decimals: 2,
          isBase: false,
        },
      ],
      defaultCurrency: 'SAR',
      availablePaymentMethods: [
        { name: 'Moyasar' },
        { name: 'PayPal' },
        { name: 'Stripe' },
        { name: 'Cash On Delivery' },
      ],
      defaultPaymentMethod: 'Moyasar',
      availableDeliveryDates: [
        {
          name: 'Tomorrow',
          daysToDeliver: 1,
          shippingPrice: 12.9,
          freeShippingMinPrice: 0,
        },
        {
          name: 'Next 3 Days',
          daysToDeliver: 3,
          shippingPrice: 6.9,
          freeShippingMinPrice: 0,
        },
        {
          name: 'Next 5 Days',
          daysToDeliver: 5,
          shippingPrice: 4.9,
          freeShippingMinPrice: 35,
        },
      ],
      defaultDeliveryDate: 'Next 5 Days',
    },
  ]

export const defaultSetting = defaultSettings[0]
