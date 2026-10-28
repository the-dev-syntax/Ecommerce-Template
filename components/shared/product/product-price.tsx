'use client'
import useSettingStore from '@/hooks/use-setting-store'
import { cn, formatCurrency, round2 } from '@/lib/utils'
import { getDirection } from '@/i18n-config'
import { useLocale, useTranslations } from 'next-intl'

const ProductPrice = ({
  price,
  className,
  listPrice = 0, // listPrice: The original price; used to show savings.
  isDeal = false,
  forListing = true, // forListing:(stylling) Tells the component where it's being used (listing or details page) to adjust its appearance accordingly.
  plain = false,
  convert = true,
  currencyCode,
}: {
  price: number
  className?: string
  listPrice?: number
  isDeal?: boolean
  forListing?: boolean
  plain?: boolean
  convert?: boolean
  currencyCode?: string
}) => {
  const { setting, getCurrency } = useSettingStore()
  const currency =
    (currencyCode &&
      setting.availableCurrencies.find((c) => c.code === currencyCode)) ||
    getCurrency()
  const t = useTranslations()
  const locale = useLocale()
  // In RTL layouts the currency symbol is rendered after the amount so it
  // appears on the left of the number.
  const isRtl = getDirection(locale) === 'rtl'
  const rate = convert === false ? 1 : currency.convertRate
  const convertedPrice = round2(rate * price)
  const convertedListPrice = round2(rate * listPrice)
  const decimals = currency.decimals ?? 2

  const discountPercent = Math.round(
    100 - (convertedPrice / convertedListPrice) * 100
  )
  const stringValue = convertedPrice.toFixed(decimals)
  const [intValue, floatValue] = stringValue.includes('.')
    ? stringValue.split('.')
    : [stringValue, '']

  const symbolNode = (
    <span className='text-xs align-super'>{currency.symbol}</span>
  )
  const amountNode = (
    <span dir='ltr'>
      {intValue}
      <span className='text-xs align-super'>{floatValue}</span>
    </span>
  )
  const priceNode = isRtl ? (
    <>
      {amountNode}
      {symbolNode}
    </>
  ) : (
    <>
      {symbolNode}
      {amountNode}
    </>
  )

  // If the 'plain' prop is true...
  // Otherwise, if there is no listprice [listprice is 0] (meaning no discount)...(no new price , the original price only)
  // Otherwise, if it's a deal...
  // Otherwise (if there's a listprice and it's not a special deal)...
  // forListing prop controls whether the justify-center class is added to the div element.
  return plain ? (
    formatCurrency(
      convertedPrice,
      currency.code,
      currency.locale,
      currency.decimals
    )
  ) : convertedListPrice == 0 ? (
    <div className={cn('text-3xl', className)}>
      {priceNode}
    </div>
  ) : isDeal ? (
    <div className='space-y-2'>
      <div className='flex justify-center items-center gap-2'>
        <span className='bg-red-700 rounded-sm p-1 text-white text-sm font-semibold'>
          {discountPercent}% {t('Off')}
        </span>
        <span className='text-red-700 text-xs font-bold'>
          {t('Limited time deal')}
        </span>
      </div>
      <div
        className={`flex ${forListing && 'justify-center'} items-center gap-2`}
      >
        <div className={cn('text-3xl', className)}>
          {priceNode}
        </div>
        <div className='text-muted-foreground text-xs py-2'>
          {t('Was')}:{' '}
          <span className='line-through'>
            {formatCurrency(
              convertedListPrice,
              currency.code,
              currency.locale,
              currency.decimals
            )}
          </span>
        </div>
      </div>
    </div>
  ) : (
    <div className=''>
      <div className='flex justify-center gap-3'>
        <div className='text-3xl text-orange-700'>-{discountPercent}%</div>
        <div className={cn('text-3xl', className)}>
          {priceNode}
        </div>
      </div>
      <div className='text-muted-foreground text-xs py-2'>
       {t('List price')}:{' '}
        <span className='line-through'>
          {formatCurrency(
            convertedListPrice,
            currency.code,
            currency.locale,
            currency.decimals
          )}
        </span>
      </div>
    </div>
  )
}

export default ProductPrice
/*
in readme the explaination of the code, line 134

listPrice: The original price; used to show savings.

forListing: Tells the component where it's being used (listing or details page) to adjust its appearance accordingly.
* explained in a simple terms :
? plain:
plain ? ( ... ) : ( ... ):  "Is this a simple request?" If the answer is "yes"  does the first thing. If "no", it does the second thing.
formatCurrency(price): If it's a simple request,just shows the price with a dollar sign and cents (like $12.50). That's it!
? listPrice:
listPrice == 0 ? ( ... ) : ( ... ): If it's not a simple request, then ask: "Is there no original price?" If the answer is "yes",
 it shows the price in a big font with a dollar sign.
? isDeal:
isDeal ? ( ... ) : ( ... ): If there is an original price, ask: "Is this a special deal?" If "yes",
 it shows a red badge saying how much you save and then the price and the original price with a line through it.
 
 ... : ( ... ): If it's not a special deal, the robot shows the percentage you save, the price, and the original price with a line through it.
 intValue and floatValue: Imagine the robot has a special way of writing the dollar amount. It separates the dollars from the cents to make it look fancy!
 
 ? forListing: is a question. is it for listing(display), the default is yes, it is for listing
  if true, it adds the justify-center class to the div element.
  if false, it doesn't.
 * forListing uses:
 ^ forListing={true} (or omitted) default: in a lista.
 Indicates the component is being used in a product listing context. In your ProductPrice code, 
 this currently centers the content of price.
 ^ forListing={false}: align left in product detail page , or non lista display.
 Indicates the component is being used on a product details page (or some other non-listing context). In your ProductPrice code, 
 this currently left aligns the content of price and changes font-sizes.
*/
