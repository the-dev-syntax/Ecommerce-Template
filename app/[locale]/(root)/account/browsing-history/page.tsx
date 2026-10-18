import { getTranslations } from 'next-intl/server'
import BrowsingHistoryGrid from './browsing-history-grid'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Browsing History'),
  }
}

export default function BrowsingHistoryPage() {
  return <BrowsingHistoryGrid />
}
