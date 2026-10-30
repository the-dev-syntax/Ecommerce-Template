import { getTranslations } from 'next-intl/server'

import Pagination from '@/components/shared/pagination'
import { getPendingReviews } from '@/lib/actions/review.actions'
import ReviewQueue from './review-queue'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations()
  return {
    title: t('Review Queue'),
  }
}

export default async function AdminReviewsPage(props: {
  searchParams: Promise<{ page: string }>
}) {
  const t = await getTranslations()
  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1
  const { data, totalPages, totalPending } = await getPendingReviews({ page })

  return (
    <main className='mx-auto max-w-6xl space-y-4 p-4'>
      <div>
        <h1 className='h1-bold'>{t('Review Queue')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('Approve customer reviews before they are published')}
        </p>
      </div>

      <ReviewQueue reviews={data} totalPending={totalPending} />

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
    </main>
  )
}
