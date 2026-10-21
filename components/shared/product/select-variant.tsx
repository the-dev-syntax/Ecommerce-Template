import { Button } from '@/components/ui/button'
import { IProduct } from '@/lib/db/models/product.model'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function SelectVariant({
  product,
  selectedVariantId,
}: {
  product: IProduct
  selectedVariantId?: string
}) {
  const t = await getTranslations()
  const variants = product.variants ?? []
  if (variants.length === 0) return null

  return (
    <div className='space-y-2'>
      <div>{t('Variant')}:</div>
      <div className='flex flex-wrap gap-2'>
        {variants.map((variant) => {
          const label =
            [variant.size, variant.color].filter(Boolean).join(' / ') ||
            variant.sku
          return (
            <Button
              asChild
              variant='outline'
              className={
                selectedVariantId === variant.id
                  ? 'border-2 border-primary'
                  : 'border-2'
              }
              key={variant.id}
            >
              <Link
                replace
                scroll={false}
                href={`?variant=${encodeURIComponent(variant.id)}`}
              >
                {label}
                {variant.countInStock === 0
                  ? ` (${t('Out of Stock')})`
                  : ''}
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
