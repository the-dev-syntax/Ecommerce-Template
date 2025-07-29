import ProductList from './product-list'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('Admin')
  return {
    title: t('Admin Products'),
  }
}

export default async function AdminProduct() {
  return <ProductList />
}