'use client'
import useBrowsingHistory from '@/hooks/use-browsing-history'
import { useEffect, useState } from 'react'
import ProductSlider from './product/product-slider'
import { Separator } from '../ui/separator'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Skeleton } from '../ui/skeleton'


export default function BrowsingHistoryList({
  className,
}: {
  className?: string
}) {
  const { products } = useBrowsingHistory()
  const t = useTranslations('Home')
  return (
    products.length !== 0 && (
      <div id='browsing-history' className='bg-background'>
        <Separator className={cn('mb-4', className)} />
        <ProductList
          title={t("Related to items that you've viewed")}
          type='related'
        />
        <Separator className='mb-4' />
        <ProductList
          title={t('Your browsing history')}
          hideDetails
          type='history'
        />
      </div>
    )
  )
}

function ProductList({
  title,
  type = 'history',
  hideDetails = false,
  excludeId = '',
}: {
  title: string
  type: 'history' | 'related'
  hideDetails?: boolean
  excludeId?:string
}) {

  const { products } = useBrowsingHistory()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
    try {
        const res = await fetch(
          `/api/products/browsing-history?type=${type}&excludeId=${excludeId}&categories=${products
            .map((product) => product.category)
            .join(',')}&ids=${products.map((product) => product.id).join(',')}`
        )
        if (!res.ok) {
            throw new Error('Failed to fetch browsing history')
          }
        const data = await res.json()
        setData(data)

      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [excludeId, products, type])

  if (isLoading) {
    // Show a loading skeleton while data is being fetched
    return (
      <div>
        <h2 className='text-xl font-bold mb-4'>Your Browsing History</h2>
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (products.length === 0) {
    // Don't render anything if there's no history
    return null
  }

  return (
    <ProductSlider title={title} products={data} hideDetails={hideDetails} />
  )
}

/*
return (
    data.length > 0 && (
      <ProductSlider title={title} products={data} hideDetails={hideDetails} />
    )
  )
*/
