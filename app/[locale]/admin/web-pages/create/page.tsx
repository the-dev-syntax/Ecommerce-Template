import WebPageForm from '../web-page-form'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(){
  const t = await getTranslations('Admin')
  return {
    title: t('Create WebPage'),
  }
}

export default async function CreateWebPagePage() {
  const t = await getTranslations('Admin')
  return (
    <>
      <h1 className='h1-bold'>{t('Create WebPage')}</h1>

      <div className='my-8'>
        <WebPageForm type='Create' />
      </div>
    </>
  )
}