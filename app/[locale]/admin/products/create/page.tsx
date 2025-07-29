import Link from 'next/link'
import { CreateProductForm } from '../CreateProduct'
import { getTranslations } from 'next-intl/server'


export async function generateMetadata(){
   const t = await getTranslations("Admin")
   return {
     title: t('Create Product')
   }
}


export default async function CreateProductPage()  {

  const t = await getTranslations("Admin")

  return (
    <main className='max-w-6xl mx-auto p-4'>
      <div className='flex mb-4'>
        <Link href='/admin/products'>{t('Products')}</Link>
        <span className='mx-1'>›</span>
        <Link href='/admin/products/create'>{t('Create')}</Link>
      </div>

      <div className='my-8'>
        <CreateProductForm />
      </div>
    </main>
  )
}

