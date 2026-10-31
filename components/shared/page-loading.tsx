import { getTranslations } from 'next-intl/server'

export default async function PageLoading() {
  const t = await getTranslations()

  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <div className='w-1/3 rounded-lg p-6 text-center shadow-md'>
        {t('Loading')}
      </div>
    </div>
  )
}
