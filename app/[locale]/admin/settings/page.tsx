import { getNoCachedSetting } from '@/lib/actions/setting.actions'
import SettingForm from './setting-form'
import SettingNav from './setting-nav'
import { getTranslations } from 'next-intl/server'


export async function generateMetadata() {
  const t = await getTranslations('Admin')
  return {
    title: t('Admin Settings'),
  }
}


export default async function SettingPage  () {
  return (
    <div className='grid md:grid-cols-5 max-w-6xl mx-auto gap-4'>
      <SettingNav />
      <main className='col-span-4 '>
        <div className='my-8'>
          <SettingForm setting={await getNoCachedSetting()} />
        </div>
      </main>
    </div>
  )
}

