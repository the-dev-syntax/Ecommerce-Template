import Link from 'next/link'
import Pagination from '@/components/shared/pagination'
import ProductCard from '@/components/shared/product/product-card'
import { Button } from '@/components/ui/button'
import {
  getAllCategories,
  getAllProducts,
  getAllTags,
} from '@/lib/actions/product.actions'
import { IProduct } from '@/lib/db/models/product.model'
import ProductSortSelector from '@/components/shared/product/product-sort-selector'
import { getFilterUrl, slugify } from '@/lib/utils'
import Rating from '@/components/shared/product/rating'
import { getTranslations } from 'next-intl/server'
import CollapsibleOnMobile from '@/components/shared/collapsible-on-mobile'
import { SORT_ORDERS, PRICE_RANGES } from '@/lib/constants';




export async function generateMetadata(props: {
  searchParams: Promise<{
    q: string
    category: string
    tag: string
    price: string
    rating: string
    sort: string
    page: string
  }>
}) {
  const searchParams = await props.searchParams
  const t = await getTranslations('Search')
  const {
    q = 'all',
    category = 'all',
    tag = 'all',
    price = 'all',
    rating = 'all',
  } = searchParams

  if (
    (q !== 'all' && q !== '') ||
    category !== 'all' ||
    tag !== 'all' ||
    rating !== 'all' ||
    price !== 'all'
  ) {
    return {  
      title: `${t('Search')} ${q !== 'all' ? q : ''} 
          ${category !== 'all' ? ` : ${t('Category')} ${category}` : ''}
          ${tag !== 'all' ? ` : ${t('Tag')} ${tag}` : ''}
          ${price !== 'all' ? ` : ${t('Price')} ${price}` : ''}
          ${rating !== 'all' ? ` : ${t('Rating')} ${rating}` : ''}`,
    }
  } else {
    return {
      title: t('Search Products'),
    }
  }
}

export default async function SearchPage(props: {
  searchParams: Promise<{
    q: string
    category: string
    tag: string
    price: string
    rating: string
    sort: string
    page: string
  }>
}) {
  const searchParams = await props.searchParams

  // const t = await getTranslations('Search')
  // const tCategory = await getTranslations('Category')
  // const tTags = await getTranslations('Tags')
const [t, tCategory, tTags] = await Promise.all([
  getTranslations('Search'),
  getTranslations('Category'),
  getTranslations('Tags')
])

  const {
    q = 'all',
    category = 'all',
    tag = 'all',
    price = 'all',
    rating = 'all',
    sort = 'best-selling',
    page = '1',
  } = searchParams

  const params = { q, category, tag, price, rating, sort, page }

  const [categories, tags, data] = await Promise.all([
    getAllCategories(),
    getAllTags(),
    getAllProducts({
      query: q,
      category,
      tag,
      price,
      rating,
      sort,
      page: Number(page),
    }),
  ])

  const noProducts = data.products.length === 0;
  if (noProducts) {
    return <div className='text-center'>{t('No product found')}</div>
  }

  const havingQueryValue = (q !== 'all' && q !== '') ||
              (category !== 'all' && category !== '') ||
              (tag !== 'all' && tag !== '') ||
              rating !== 'all' ||
              price !== 'all';

  return (
    <div>
      <div className='mb-2 py-2 md:border-b flex-between flex-col md:flex-row '>
        <div className='flex items-center'>
          {
            data.totalProducts === 0
              ? t('No')
              : `${data.from} - ${data.to} ${t('of')} ${data.totalProducts}`
          }
          {' '}
          {t('results')}
          { havingQueryValue ? ` ${t('for')} `: null }
          { q !== 'all' && q !== '' && '"' + q + '"' }
          { category !== 'all' && category !== '' && <span className='font-bold ml-2 mr-2'>{t('Category')}: {tCategory(category)}</span> }
          { tag !== 'all' && tag !== '' && <span className='font-bold ml-2 mr-2'>{t('Tag')}: {tTags(tag)}</span> }
          { price !== 'all' && <span className='font-bold ml-2 mr-2'>{t('Price')}: {price}</span> }
          { rating !== 'all' && <span className='font-bold ml-2 mr-2'>{t('Rating')}: {rating}  {t('& Up')}</span> }
          &nbsp;
          {
            havingQueryValue ? (
                <Button variant={'link'} asChild>
                  <Link href='/search'>{t('Clear')}</Link>
                </Button>
            ) : null
          }
        </div>
        <div>  
          <ProductSortSelector
            sortOrders={SORT_ORDERS}
            sort={sort}
            params={params}
          />
        </div>
      </div>
      <div className='bg-card grid md:grid-cols-5 md:gap-4'>
        <CollapsibleOnMobile title={t('Filters')}> 
          <div className='space-y-4'>
            <div className='font-semibold'>
              <Link className='text-primary' href='/search'>
                    {t('All Products')}
                  </Link>             
               </div>
            <div>
              <div className='font-bold'>{t('Department')}</div>
              <ul>
                <li>
                  <Link
                    className={`${
                      ('all' === category || '' === category) && 'text-primary'
                    }`}
                    href={getFilterUrl({ category: 'all', params })}
                  >
                    {t('All')}
                  </Link>
                </li>
                {categories.map((c: string) => (
                  <li key={c}>
                    <Link
                      className={`${c === category && 'text-primary'}`}
                      href={getFilterUrl({ category: c, params })}
                    >
                      {tCategory(c)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className='font-bold'>{t('Price')}</div>
              <ul>
                <li>
                  <Link
                    className={`${'all' === price && 'text-primary'}`}
                    href={getFilterUrl({ price: 'all', params })}
                  >
                     {t('All')}
                  </Link>
                </li>
                {PRICE_RANGES.map((p) => (
                  <li key={p.value}>
                    <Link
                      className={`${p.value === price && 'text-primary'}`}
                      href={getFilterUrl({ price: p.value, params })}
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className='font-bold'>{t('Customer Review')}</div>
              <ul>
                <li>
                  <Link
                    className={`${'all' === rating && 'text-primary'}`}
                    href={getFilterUrl({ rating: 'all', params })}
                  >
                     {t('All')}
                  </Link>
                </li>

                <li>
                  <Link
                    className={`${'4' === rating && 'text-primary'}`}
                    href={getFilterUrl({ rating: '4', params })}
                  >
                    <div className='flex'>
                      <Rating size={4} rating={4} /> {t('& Up')}
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className='font-bold'>{t('Tag')}</div>
              <ul>
                <li>
                  <Link
                    className={`${
                      ('all' === tag || '' === tag) && 'text-primary'
                    }`}
                    href={getFilterUrl({ tag: 'all', params })}
                  >
                    {t('All')}
                  </Link>
                </li>
                {tags.map((t: string) => (
                  <li key={t}>
                    <Link
                      className={`${slugify(t) === tag && 'text-primary'}`}
                      href={getFilterUrl({ tag: t, params })}
                    >
                      {tTags(t)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CollapsibleOnMobile>

        <div className='md:col-span-4 space-y-4'>
          <div>
            <div className='font-bold text-xl'>{t('Results')}</div>
            <div>{t('Check each product page for other buying options')}</div>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-2  lg:grid-cols-3  '>
            {noProducts && <div> {t('No product found')}</div>}
            {data.products.map((product: IProduct) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <Pagination page={page} totalPages={data.totalPages} />
          )}
        </div>
      </div>
    </div>
  )
}