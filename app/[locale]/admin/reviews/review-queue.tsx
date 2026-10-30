'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/routing'

import DeleteDialog from '@/components/shared/delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { approveReview, deleteReview } from '@/lib/actions/review.actions'

type PendingReview = {
  _id: string
  title: string
  comment: string
  rating: number
  createdAt: string
  isVerifiedPurchase: boolean
  user?: { name?: string; email?: string } | null
  product?: { _id: string; name?: string; slug?: string } | null
}

export default function ReviewQueue({
  reviews,
  totalPending,
}: {
  reviews: PendingReview[]
  totalPending: number
}) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const onApprove = async (id: string) => {
    setApprovingId(id)
    const result = await approveReview(id)
    setApprovingId(null)
    toast({
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })
    if (result.success) router.refresh()
  }

  if (reviews.length === 0) {
    return <p className='text-muted-foreground'>{t('No pending reviews')}</p>
  }

  return (
    <div className='space-y-2'>
      <p className='text-sm'>
        {t('Pending')}: {totalPending}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Product')}</TableHead>
            <TableHead>{t('Name')}</TableHead>
            <TableHead>{t('Rating')}</TableHead>
            <TableHead>{t('Comment')}</TableHead>
            <TableHead>{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => (
            <TableRow key={review._id}>
              <TableCell>
                {review.product?.slug ? (
                  <Link
                    href={`/product/${review.product.slug}`}
                    className='underline'
                  >
                    {review.product.name ?? review.product.slug}
                  </Link>
                ) : (
                  t('Deleted')
                )}
              </TableCell>
              <TableCell>
                {review.user?.name ?? review.user?.email ?? t('Deleted User')}
              </TableCell>
              <TableCell>{review.rating}/5</TableCell>
              <TableCell className='max-w-md'>
                <div className='font-semibold'>{review.title}</div>
                <div className='text-muted-foreground text-sm'>
                  {review.comment}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {review.createdAt.substring(0, 10)}
                </div>
              </TableCell>
              <TableCell className='flex gap-1'>
                <Button
                  size='sm'
                  onClick={() => onApprove(review._id)}
                  disabled={approvingId === review._id}
                >
                  {approvingId === review._id
                    ? t('Approving')
                    : t('Approve')}
                </Button>
                <DeleteDialog id={review._id} action={deleteReview} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
