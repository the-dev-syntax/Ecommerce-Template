import OverviewReport from './overview-report'
import { auth } from '@/auth'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Admin Dashboard'),
  }
}
const DashboardPage = async (props: {
  searchParams: Promise<{ from?: string; to?: string }>
}) => {
  const searchParams = await props.searchParams
  
  const session = await auth()
  if (session?.user.role !== 'admin')
    throw new Error('Admin permission required')

  return (
    <OverviewReport
      fromParam={searchParams.from}
      toParam={searchParams.to}
    />
  )
}

export default DashboardPage

