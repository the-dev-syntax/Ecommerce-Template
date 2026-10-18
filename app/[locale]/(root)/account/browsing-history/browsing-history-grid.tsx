'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { IProduct } from '@/lib/db/models/product.model'
import ProductCard from '@/components/shared/product/product-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import useBrowsingHistory from '@/hooks/use-browsing-history'
import {
  clearBrowsingHistory,
  getBrowsingHistory,
} from '@/lib/actions/browsing-history.actions'
import { clearBrowsingHistoryDirty } from '@/lib/sync-browsing-history'
import { MAX_BROWSING_HISTORY } from '@/lib/constants'

const STEP = 20

type Item = { productId: string; category: string }

export default function BrowsingHistoryGrid() {
  const t = useTranslations()
  const { products, clear } = useBrowsingHistory()

  const [dbItems, setDbItems] = useState<Item[]>([])
  const [dbLoaded, setDbLoaded] = useState(false)
  const [data, setData] = useState<IProduct[]>([])
  const [visible, setVisible] = useState(STEP)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getBrowsingHistory().then((res) => {
      setDbItems(res.items)
      setDbLoaded(true)
    })
  }, [])

  // local first, then DB up to the cap, without duplicates
  const merged: Item[] = (() => {
    const out: Item[] = []
    const seen = new Set<string>()
    for (const p of products) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push({ productId: p.id, category: p.category })
    }
    for (const item of dbItems) {
      if (out.length >= MAX_BROWSING_HISTORY) break
      if (seen.has(item.productId)) continue
      seen.add(item.productId)
      out.push(item)
    }
    return out
  })()

  const idsKey = merged.map((m) => m.productId).join(',')

  useEffect(() => {
    if (!dbLoaded) return
    if (!idsKey) {
      setData([])
      setIsLoading(false)
      return
    }
    let active = true
    setIsLoading(true)
    const categories = merged.map((m) => m.category).join(',')
    fetch(
      `/api/products/browsing-history?type=history&ids=${idsKey}&categories=${categories}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        setData(json)
        setIsLoading(false)
      })
      .catch(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, dbLoaded])

  const handleClear = async () => {
    await clearBrowsingHistory()
    clear()
    clearBrowsingHistoryDirty()
    setDbItems([])
    setData([])
  }

  if (isLoading) {
    return (
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className='h-64 w-full' />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className='py-16 text-center text-muted-foreground'>
        {t('Your browsing history is empty')}
      </div>
    )
  }

  return (
    <div>
      <h1 className='h1-bold py-4'>{t('Browsing History')}</h1>

      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
        {data.slice(0, visible).map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>

      {visible < data.length && (
        <div className='flex justify-center mt-6'>
          <Button variant='outline' onClick={() => setVisible((v) => v + STEP)}>
            {t('Show more')}
          </Button>
        </div>
      )}

      <div className='flex justify-center mt-8'>
        <Button variant='destructive' onClick={handleClear}>
          {t('Clear browsing history')}
        </Button>
      </div>
    </div>
  )
}
