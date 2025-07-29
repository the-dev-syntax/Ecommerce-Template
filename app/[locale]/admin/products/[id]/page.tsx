import { notFound } from 'next/navigation'

import { getProductById } from '@/lib/actions/product.actions'
import Link from 'next/link'
import { UpdateProductForm } from '../UpdateProducts'
import { getTranslations } from 'next-intl/server'


export async function generateMetadata(){
   const t = await getTranslations("Admin")
   return {
     title: t('Edit Product'),
   }
}


const UpdateProduct = async (props: {
  params: Promise<{
    id: string
  }>
}) => {
  const params = await props.params
  const { id } = params
  const t = await getTranslations("Admin")

  const product = await getProductById(id)
  if (!product) notFound()
  return (
    <main className='max-w-6xl mx-auto p-4'>
      <div className='flex mb-4'>
        <Link href='/admin/products'>{t('Products')}</Link>
        <span className='mx-1'>›</span>
        <Link href={`/admin/products/${product._id}`}>{product._id}</Link>
        <Link href={`/admin/products/${product._id}`}>{product.name}</Link>
      </div>

      <div className='my-8'>
        <UpdateProductForm product={product} productId={product._id} />
      </div>
    </main>
  )
}

export default UpdateProduct