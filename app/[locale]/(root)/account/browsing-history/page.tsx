import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getSetting } from '@/lib/actions/setting.actions'
import BrowsingHistoryGrid from './browsing-history-grid'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Browsing History'),
  }
}

export default async function BrowsingHistoryPage() {
  const { features } = await getSetting()
  if (!features.browsingHistory) notFound()
  return <BrowsingHistoryGrid />
}
