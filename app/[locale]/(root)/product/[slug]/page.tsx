import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { getAllProductSlugs, getProductBySlug, getRelatedProductsByCategory } from '@/lib/actions/product.actions'
import { generateId, round2 } from '@/lib/utils'

import SelectVariant from '@/components/shared/product/select-variant'
import ProductPrice from '@/components/shared/product/product-price'
import ProductGallery from '@/components/shared/product/product-gallery'
import ProductSlider from '@/components/shared/product/product-slider'
import BrowsingHistoryList from '@/components/shared/browsing-history-list'
import AddToBrowsingHistory from '@/components/shared/product/add-to-browsing-history'
import AddToCart from '@/components/shared/product/add-to-cart'
// import Rating from '@/components/shared/product/rating'

import ReviewList from './review-list'
import { auth } from '@/auth'
import RatingSummary from '@/components/shared/product/rating-summary'
import { getTranslations } from 'next-intl/server'
import { i18n } from '@/i18n-config'

export async function generateStaticParams() {
 
  const slugs :{slug: string}[] = await getAllProductSlugs(); // return: [{ slug: 't-shirt' }, { slug: 'coffee-mug' }]
  const locales = i18n.locales;    // Should return an array like ['en-US', 'fr', 'ar']

  // 2. Create a list of all possible paths
  const params = locales.flatMap((locale) =>
    slugs.map((productSlug) => ({
      locale: locale.code, // e.g., 'en-US'
      slug: productSlug.slug,  // e.g., 't-shirt'
    }))
  );
  return params;
}


export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}) {
  const params = await props.params
  const product = await getProductBySlug(params.slug)
  if (!product) {
    return { title: 'Product not found' }
  }
  return {
    title: product.name,
    description: product.description,
  }
}

export default async function ProductDetails(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page: string; color: string; size: string }>
}) {

  const searchParams = await props.searchParams

  const { page, color, size } = searchParams

  const params = await props.params

  const { slug } = params

  const product = await getProductBySlug(slug)

  const relatedProducts = await getRelatedProductsByCategory({
    category: product.category,
    productId: product._id,
    page: Number(page || '1'),
  })

  const session = await auth()

  const t = await getTranslations('Product')
  
  //used in order: AddToBrowsingHistory, ProductGallery, Rating, Separator, ProductPrice, SelectVariant, Separator, Card, addToCart
  return (
    <div>
      <AddToBrowsingHistory id={product._id} category={product.category} />
      <section>
        <div className='grid grid-cols-1 md:grid-cols-5  '>
          <div className='col-span-2'>
            <ProductGallery images={product.images} />
          </div>

          <div className='flex w-full flex-col gap-2 md:p-5 col-span-2'>
            <div className='flex flex-col gap-3'>
              <p className='p-medium-16 rounded-full bg-grey-500/10   text-grey-500'>
                {t('Brand')}{' '}:{' '}{product.brand} {product.category}
              </p>
              <h1 className='font-bold text-lg lg:text-xl'>{product.name}</h1>
              <div className='flex items-center gap-2'>
                <RatingSummary
                  avgRating={product.avgRating}
                  numReviews={product.numReviews}
                  asPopover
                  ratingDistribution={product.ratingDistribution}
                />
              </div>
              <Separator />
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
                <div className='flex gap-3'>
                  <ProductPrice
                    price={product.price}
                    listPrice={product.listPrice}
                    isDeal={product.tags.includes('todays-deal')}
                    forListing={false}
                  />
                </div>
              </div>
            </div>
            <div>
              <SelectVariant
                product={product}
                size={size || product.sizes[0]}
                color={color || product.colors[0]}
              />
            </div>
            <Separator className='my-2' />
            <div className='flex flex-col gap-2'>
              <p className='p-bold-20 text-grey-600'>{t('Description')}:</p>
              <p className='p-medium-16 lg:p-regular-18'>
                {product.description}
              </p>
            </div>
          </div>
          <div>
            <Card>
              <CardContent className='p-4 flex flex-col  gap-4'>
                <ProductPrice price={product.price} />
                {/* 1-if countInStock = a number and it is = 1,2,3 only. 2-if not 0, else out of stock  */}
                {product.countInStock > 0 && product.countInStock <= 3 && (
                  <div className='text-destructive font-bold'>
                    {t('OnlyOrderSoon', { countInStock: product.countInStock })}               
                  </div>
                )}
                {product.countInStock !== 0 ? (
                  <div className='text-green-700 text-xl'>{t('In Stock')}</div>
                ) : (
                  <div className='text-destructive text-xl'>{t('Out of Stock')}</div>
                )}
                  {product.countInStock !== 0 && (
                    <div className='flex justify-center items-center'>
                      <AddToCart
                        item={{
                          clientId: generateId(),
                          product: product._id,
                          countInStock: product.countInStock,
                          name: product.name,
                          slug: product.slug,
                          category: product.category,
                          price: round2(product.price),
                          quantity: 1,
                          image: product.images[0],
                          size: size || product.sizes[0],
                          color: color || product.colors[0],
                        }}
                      />
                    </div>
                  )}
              </CardContent>
            </Card>

            
          </div>        
        </div>
      </section>

      <section className='mt-10'>
        <h2 className='h2-bold mb-2' id='reviews'>
          {t('Customer Reviews')}
        </h2>
        <ReviewList product={product} userId={session?.user.id} />
      </section>

      <section className='mt-10'>
        <ProductSlider
          products={relatedProducts.data}
          title={t('Best Sellers in', { name: product.category })}
        />
      </section>
      <section>
        <BrowsingHistoryList className='mt-10' />
      </section>
    </div>
  )
}

// as this is a dynamic route we need to pass the slug variable to all functions in the page by passing it as props
/* props is an object which have params: which is an object which have slug inside it , 
 and searchParams: which is an object which have page, color and size inside it.
* example:
 props = {slug: 'product-slug', searchParams: {page: '1', color: 'red', size: 'M'}} and all inside props are promises.


 <h1 className='font-bold text-lg lg:text-xl'>{product.name}</h1>
              <div className='flex items-center gap-2'>
                <span>{product.avgRating.toFixed(1)}</span>
                <Rating rating={product.avgRating} />
                <span>{product.numReviews} ratings</span>
              </div>
              <Separator />
*/
