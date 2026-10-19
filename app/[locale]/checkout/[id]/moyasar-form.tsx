'use client'

import { useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import type { IOrder } from '@/lib/db/models/order.model'
import useCartStore from '@/hooks/use-cart-store'
import { useToast } from '@/hooks/use-toast'
import { updateOrderToPaidByMoyasar } from '@/lib/actions/order.actions'

const MOYASAR_SCRIPT_ID = 'moyasar-js'
const MOYASAR_CSS_ID = 'moyasar-css'
const MOYASAR_SCRIPT_URL = 'https://cdn.moyasar.com/moyasar.js'
const MOYASAR_CSS_URL = 'https://cdn.moyasar.com/moyasar.css'
const FORM_ELEMENT_ID = 'moyasar-payment-form'

let scriptPromise: Promise<void> | null = null

function loadMoyasar(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Moyasar) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  const promise = new Promise<void>((resolve, reject) => {
    if (!document.getElementById(MOYASAR_CSS_ID)) {
      const link = document.createElement('link')
      link.id = MOYASAR_CSS_ID
      link.rel = 'stylesheet'
      link.href = MOYASAR_CSS_URL
      document.head.appendChild(link)
    }

    const existing = document.getElementById(
      MOYASAR_SCRIPT_ID
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Moyasar failed to load')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = MOYASAR_SCRIPT_ID
    script.src = MOYASAR_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Moyasar failed to load'))
    document.body.appendChild(script)
  })

  // Allow a later mount to retry after a network/CDN failure.
  scriptPromise = promise.catch((error) => {
    scriptPromise = null
    document.getElementById(MOYASAR_SCRIPT_ID)?.remove()
    throw error
  })

  return scriptPromise
}

export default function MoyasarForm({
  order,
  publishableKey,
}: {
  order: IOrder
  publishableKey: string
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const { toast } = useToast()
  const { clearCart } = useCartStore()

  useEffect(() => {
    if (!publishableKey) return

    let active = true

    loadMoyasar()
      .then(() => {
        if (!active) return
        const element = document.getElementById(FORM_ELEMENT_ID)
        if (!element || !window.Moyasar) {
          throw new Error('Moyasar form element not found')
        }

        element.innerHTML = ''
        window.Moyasar.init({
          element,
          amount: Math.round(order.totalPrice * 100),
          currency: order.currency,
          description: `Order ${order._id}`,
          publishable_api_key: publishableKey,
          callback_url: `${window.location.origin}${window.location.pathname}/moyasar-payment-success`,
          metadata: { orderId: order._id },
          methods: ['creditcard', 'stcpay'],
          supported_networks: [
            'mada',
            'visa',
            'mastercard',
            'amex',
            'unionpay',
          ],
          // Moyasar ships English/Arabic; French would need custom
          // translations, so fall back to English for other locales.
          language: locale.startsWith('ar') ? 'ar' : 'en',
          fixed_width: false,
          on_completed: async (payment) => {
            // `initiated` means 3DS is next; the callback page will verify.
            if (payment.status !== 'paid' && payment.status !== 'captured')
              return

            const res = await updateOrderToPaidByMoyasar(
              order._id,
              payment.id
            )

            if (!res.success) {
              toast({
                description: res.message,
                variant: 'destructive',
              })
              return
            }

            clearCart()
            toast({ description: res.message })
            router.push(`/account/orders/${order._id}`)
            router.refresh()
          },
          on_failure: (error) => {
            toast({ description: error, variant: 'destructive' })
          },
        })
      })
      .catch((error: unknown) => {
        toast({
          description:
            error instanceof Error ? error.message : 'Moyasar failed to load',
          variant: 'destructive',
        })
      })

    return () => {
      active = false
    }
  }, [
    clearCart,
    locale,
    order._id,
    order.currency,
    order.totalPrice,
    publishableKey,
    router,
    toast,
  ])

  if (!publishableKey) {
    return (
      <p className='text-destructive text-sm'>
        {t('MoyasarNotConfigured')}
      </p>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='text-xl'>{t('Payment Method')}</div>
      <div id={FORM_ELEMENT_ID} />
    </div>
  )
}
