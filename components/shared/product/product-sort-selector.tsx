'use client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getFilterUrl } from '@/lib/utils'
import { useRouter } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import React from 'react'


// sortOrder like = price:low to high, best-sellers,... "popup list"  , sort the value chosen from the list or checked or linked.
export default function ProductSortSelector({
  sortOrders,
  sort,
  params,
}: {
  sortOrders: { value: string, name: string }[]
  sort: string
  params: {
    q?: string
    category?: string
    price?: string
    rating?: string
    sort?: string
    page?: string
  }
}) {

  const router = useRouter()
  const t = useTranslations()

  return (
    <Select
      onValueChange={(v) => {
        router.push(getFilterUrl({ params, sort: v }))
      }}
      value={sort}
    >
      <SelectTrigger>
        <SelectValue>
          Sort By: {sortOrders.find((s) => s.value === sort)?.name ?? t('Best selling')}
        </SelectValue>
      </SelectTrigger>

      <SelectContent>
        {sortOrders.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}