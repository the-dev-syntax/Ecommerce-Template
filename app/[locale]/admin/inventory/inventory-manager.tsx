'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { adjustInventory } from '@/lib/actions/inventory.actions'
import { formatId } from '@/lib/utils'

type InventoryProduct = {
  _id: string
  name: string
  countInStock: number
  variants: {
    id: string
    sku: string
    label: string
    countInStock: number
  }[]
}

type LowStockRow = {
  productId: string
  productName: string
  slug: string
  variantId: string
  sku: string
  variantLabel: string
  stock: number
  threshold: number
}

type AdjustmentRow = {
  _id: string
  productName: string
  variantLabel?: string
  sku?: string
  previousStock: number
  newStock: number
  quantityChange: number
  source: string
  reason?: string
  note?: string
  actorEmail?: string
  orderId?: string
  createdAt: string
}

export default function InventoryManager({
  products,
  lowStock,
  adjustments,
}: {
  products: InventoryProduct[]
  lowStock: LowStockRow[]
  adjustments: AdjustmentRow[]
}) {
  const t = useTranslations()
  const router = useRouter()
  const { toast } = useToast()
  const [productId, setProductId] = useState(products[0]?._id ?? '')
  const [variantId, setVariantId] = useState('')
  const [quantityChange, setQuantityChange] = useState('')
  const [reason, setReason] = useState('stock_count')
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const selectedProduct = useMemo(
    () => products.find((product) => product._id === productId),
    [productId, products]
  )

  const onSubmit = async () => {
    setIsSaving(true)
    const result = await adjustInventory({
      productId,
      variantId: variantId || undefined,
      quantityChange: Number(quantityChange),
      reason,
      note,
    })
    setIsSaving(false)
    toast({
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })
    if (result.success) {
      setQuantityChange('')
      setNote('')
      router.refresh()
    }
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>{t('Adjust stock')}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='space-y-1'>
              <Label>{t('Product')}</Label>
              <Select
                value={productId}
                onValueChange={(value) => {
                  setProductId(value)
                  setVariantId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select a product')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label>{t('Variant')}</Label>
              <Select
                value={variantId || '__none__'}
                onValueChange={(value) =>
                  setVariantId(value === '__none__' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select a variant')} />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct?.variants.length ? (
                    selectedProduct.variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.label || variant.sku} ({variant.countInStock})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value='__none__'>{t('Default stock')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label>{t('Quantity change')}</Label>
              <Input
                type='number'
                placeholder={t('Use a negative number to remove stock')}
                value={quantityChange}
                onChange={(event) => setQuantityChange(event.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <Label>{t('Reason')}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='stock_count'>{t('Stock count')}</SelectItem>
                  <SelectItem value='received'>{t('Stock received')}</SelectItem>
                  <SelectItem value='damaged'>{t('Damaged stock')}</SelectItem>
                  <SelectItem value='returned'>{t('Returned stock')}</SelectItem>
                  <SelectItem value='correction'>{t('Correction')}</SelectItem>
                  <SelectItem value='other'>{t('Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label>{t('Note')}</Label>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('Optional note')}
              />
            </div>

            <Button
              type='button'
              onClick={onSubmit}
              disabled={
                isSaving ||
                !productId ||
                !quantityChange ||
                Number(quantityChange) === 0 ||
                (Boolean(selectedProduct?.variants.length) && !variantId)
              }
            >
              {isSaving ? t('Saving') : t('Save adjustment')}
            </Button>
          </CardContent>
        </Card>

        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle>
              {t('Low stock alerts')} ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Product')}</TableHead>
                  <TableHead>{t('Variant')}</TableHead>
                  <TableHead className='text-end'>{t('Stock')}</TableHead>
                  <TableHead className='text-end'>{t('Threshold')}</TableHead>
                  <TableHead>{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className='text-muted-foreground'>
                      {t('No low-stock products')}
                    </TableCell>
                  </TableRow>
                )}
                {lowStock.map((row) => (
                  <TableRow key={`${row.productId}-${row.variantId}`}>
                    <TableCell>
                      <Link
                        href={`/admin/products/${row.productId}`}
                        className='underline'
                      >
                        {row.productName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.variantLabel || row.sku || t('Default')}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Badge variant={row.stock === 0 ? 'destructive' : 'secondary'}>
                        {row.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-end'>{row.threshold}</TableCell>
                    <TableCell>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          setProductId(row.productId)
                          setVariantId(row.variantId)
                        }}
                      >
                        {t('Adjust')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Recent inventory adjustments')}</CardTitle>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Date')}</TableHead>
                <TableHead>{t('Product')}</TableHead>
                <TableHead>{t('Variant')}</TableHead>
                <TableHead className='text-end'>{t('Change')}</TableHead>
                <TableHead className='text-end'>{t('Stock')}</TableHead>
                <TableHead>{t('Source')}</TableHead>
                <TableHead>{t('Reason')}</TableHead>
                <TableHead>{t('By')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground'>
                    {t('No inventory adjustments yet')}
                  </TableCell>
                </TableRow>
              )}
              {adjustments.map((row) => (
                <TableRow key={row._id}>
                  <TableCell>
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {row.productName}
                    <span className='text-muted-foreground block text-xs'>
                      {formatId(row._id)}
                    </span>
                    {row.orderId && (
                      <Link
                        href={`/admin/orders/${row.orderId}`}
                        className='block text-xs underline'
                      >
                        {formatId(row.orderId)}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.variantLabel || row.sku || t('Default')}
                  </TableCell>
                  <TableCell
                    className={`text-end ${
                      row.quantityChange < 0 ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {row.quantityChange > 0 ? '+' : ''}
                    {row.quantityChange}
                  </TableCell>
                  <TableCell className='text-end'>
                    {row.previousStock} → {row.newStock}
                  </TableCell>
                  <TableCell>{row.source.replaceAll('_', ' ')}</TableCell>
                  <TableCell>
                    {row.reason?.replaceAll('_', ' ')}
                    {row.note ? (
                      <span className='text-muted-foreground block text-xs'>
                        {row.note}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.actorEmail || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
