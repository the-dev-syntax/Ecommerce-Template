import { getTranslations } from "next-intl/server"

export default async function LoadingPage() {
  const t = await getTranslations('Loading')
    return (
      <div className='flex flex-col items-center justify-center min-h-screen '>
        <div className='p-6 rounded-lg shadow-md w-1/3 text-center'>
          {t('Loading')}
        </div>
      </div>
    )
  }