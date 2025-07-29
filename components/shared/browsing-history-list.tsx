'use client'
import useBrowsingHistory from '@/hooks/use-browsing-history'
import React, { useEffect } from 'react'
import ProductSlider from './product/product-slider'
import { Separator } from '../ui/separator'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'


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
  const [data, setData] = React.useState([])
  useEffect(() => {
    const fetchProducts = async () => {
      const res = await fetch(
        `/api/products/browsing-history?type=${type}&excludeId=${excludeId}&categories=${products
          .map((product) => product.category)
          .join(',')}&ids=${products.map((product) => product.id).join(',')}`
      )
      const data = await res.json()
      setData(data)
    }
    fetchProducts()
  }, [excludeId, products, type])

  return (
    data.length > 0 && (
      <ProductSlider title={title} products={data} hideDetails={hideDetails} />
    )
  )
}

/*
recommended code change Gemini

function ProductList(...) { // Same as before, but add loading state
  const { products } = useBrowsingHistory()
  const [data, setData] = React.useState([])
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null); // Clear any previous errors
      try {
        const res = await fetch(
          `/api/products/browsing-history?type=${type}&categories=${products
            .map((product) => product.category)
            .join(',')}&ids=${products.map((product) => product.id).join(',')}`
        );

        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`); // Handle non-200 responses
        }

        const data = await res.json();
        setData(data);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError(err); // Store the error
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [products, type]);

  if (loading) {
    return <div>Loading products...</div>; // Simple loading indicator
  }

  if (error) {
    return <div>Error: {error.message}</div>; // Display the error message
  }

  return (
    data.length > 0 && (
      <ProductSlider title={title} products={data} hideDetails={hideDetails} />
    )
  );
}
*/
