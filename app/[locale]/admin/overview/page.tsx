import OverviewReport from './overview-report'
import { auth } from '@/auth'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('Admin')
  return {
    title: t('Admin Dashboard'),
  }
}
const DashboardPage = async () => {
  const session = await auth()
  if (session?.user.role !== 'Admin')
    throw new Error('Admin permission required')

  return <OverviewReport />
}

export default DashboardPage

