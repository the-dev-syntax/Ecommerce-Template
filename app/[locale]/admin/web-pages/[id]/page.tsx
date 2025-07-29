import { notFound } from 'next/navigation'
import { getWebPageById } from '@/lib/actions/web-page.actions'
import Link from 'next/link'
import WebPageForm from '../web-page-form'
import { getTranslations } from 'next-intl/server'



export async function generateMetadata() {
  const t = await getTranslations('Admin')
  return {
    title: t('Admin WebPage'),
  }
}

export default async function UpdateWebPage(props: { params: Promise<{ id: string }> })  {
  
  const param = await props.params
  const { id } = param
  const webPage = await getWebPageById(id)
  if (!webPage) notFound()

  const t = await getTranslations('Admin')

  return (
    <main className='max-w-6xl mx-auto p-4'>
      <div className='flex mb-4'>
        <Link href='/admin/web-pages'>{t('Web Pages')}</Link>
        <span className='mx-1'>›</span>
        <Link href={`/admin/web-pages/${webPage._id}`}>{webPage._id}</Link>
      </div>

      <div className='my-8'>
        <WebPageForm type='Update' webPage={webPage} webPageId={webPage._id} />
      </div>
    </main>
  )
}

