'use client'
import { getMonthName } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import ProductPrice from '@/components/shared/product/product-price'
import { useTranslations } from 'next-intl'



//"The data prop must be an array. If that array has any items in it, every single one of them must match the specified object shape."
type TableChartProps = {
  labelType: 'month' | 'product'
  data: {
    label: string 
    image?: string
    value: number
    id?: string
  }[]
}

interface ProgressBarProps {
  value: number // Accepts a number between 0 and 100
  className?: string
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value }) => {
  // Ensure value stays within 0-100 range , Math.min ==> returns the smallest of the given numbers.
  const boundedValue = Math.min(100, Math.max(0, value))

  return (
    <div className='relative w-full h-4 overflow-hidden'>
      <div
        className='bg-primary h-full transition-all duration-300 rounded-lg'
        style={{
          width: `${boundedValue}%`,
          float: 'right', // Aligns the bar to start from the right
        }}
      />
    </div>
  )
}

 
export default function TableChart({
  labelType = 'month',
  data = [],
}: TableChartProps) {

  const t = useTranslations('Admin');
  const max = Math.max(...data.map((item) => item.value))
  const dataWithPercentage = data.map((x) => {
  let finalLabel = x.label;

  if (labelType === 'month') {
    const monthLabel = getMonthName(x.label); // e.g., "July (ongoing)"
    finalLabel = monthLabel.includes('ongoing')
      ? monthLabel.replace('ongoing', t('ongoing'))
      : monthLabel;
  }

  return {
    ...x,
    label: finalLabel,
    percentage: Math.round((x.value / max) * 100),
  };
});

  return (
    <div className='space-y-3'>
      {dataWithPercentage.map(({ label, id, value, image, percentage }) => (
        <div
          key={label}
          className='grid grid-cols-[100px_1fr_80px] md:grid-cols-[250px_1fr_80px] gap-2 space-y-4  '
        >
          {image ? (
            <Link className='flex items-end' href={`/admin/products/${id}`}>
              <Image
                className='rounded border  aspect-square object-scale-down max-w-full h-auto mx-auto mr-1'
                src={image!}
                alt={label}
                width={36}
                height={36}
              />
              <p className='text-center text-sm whitespace-nowrap overflow-hidden text-ellipsis'>
                {label}
              </p>
            </Link>
          ) : (
            <div className='flex items-end text-sm'>{label}</div>
          )}

          <ProgressBar value={percentage} />

          <div className='text-sm text-right flex items-center'>
            <ProductPrice price={value} plain />
          </div>
        </div>
      ))}
    </div>
  )
}