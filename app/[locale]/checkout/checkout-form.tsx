'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  calculateFutureDate,
  formatDateTime,
  timeUntilMidnight,
} from '@/lib/utils'
import { ShippingAddressSchema } from '@/lib/validator'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import { useRouter, Link } from '@/i18n/routing'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import CheckoutFooter from './checkout-footer'
import { ShippingAddress } from '@/types'
import type { UserAddress } from '@/types'
import { normalizeSaudiPhone } from '@/lib/phone'
import PhoneVerification from '@/components/shared/phone/phone-verification'
import useIsMounted from '@/hooks/use-is-mounted'
import useCartStore from '@/hooks/use-cart-store'
import ProductPrice from '@/components/shared/product/product-price'
import { createOrder } from '@/lib/actions/order.actions'
import { getEnabledPaymentMethods } from '@/lib/payments'
import { toast } from '@/hooks/use-toast'
import useSettingStore from '@/hooks/use-setting-store'
import { useTranslations } from 'next-intl'


const shippingAddressDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
      fullName: 'Deca',
      street: '1911, 65 Prince bander Est',
      city: 'Riyadh',
      province: 'Riyadh',
      district: 'Al Olaya',
      nationalAddress: 'RFKB4744',
      phone: '512345678',
      postalCode: 'A8C 1H4',
      country: 'Saudi Arabia',
    }
    : {
      fullName: '',
      street: '',
      city: '',
      province: '',
      district: '',
      nationalAddress: '',
      phone: '',
      postalCode: '',
      country: '',
    }

function toShippingAddress(address: UserAddress): ShippingAddress {
  return {
    fullName: address.fullName,
    street: address.street,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    district: address.district,
    nationalAddress: address.nationalAddress,
    phone: normalizeSaudiPhone(address.phone) ?? address.phone,
  }
}

const CheckoutForm = ({
  savedAddresses = [],
  verifiedPhones = [],
  ownerId,
}: {
  savedAddresses?: UserAddress[]
  verifiedPhones?: string[]
  ownerId?: string
}) => {
  const router = useRouter()
  const t = useTranslations()
  const [verifiedPhoneList, setVerifiedPhoneList] =
    useState<string[]>(verifiedPhones)

  const { setting: {
    site,
    availableDeliveryDates: settingDeliveryDates,
    availablePaymentMethods,
    availableCurrencies,
    defaultCurrency,
    defaultPaymentMethod,
    features,
    currency: displayCurrency,
  }
  } = useSettingStore()

  const orderCurrency =
    availableCurrencies.find((currency) => currency.isBase)?.code ??
    defaultCurrency

  const enabledPaymentMethods = getEnabledPaymentMethods(
    availablePaymentMethods,
    { cashOnDelivery: features.cashOnDelivery }
  )
  const defaultEnabledPaymentMethod =
    enabledPaymentMethods[0]?.name ?? defaultPaymentMethod

  const {
    cart: {
      items,
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice,
      taxInclusive = true,
      codFee = 0,
      isPickup = false,
      pickupLocation,
      shippingAddress,
      deliveryDateIndex,
      paymentMethod: storedPaymentMethod,
      availableDeliveryDates: cartDeliveryDates,
    },
    updateItem,
    removeItem,
    // clearCart,
    refreshCart,
    setCartOwner,
    setShippingAddress,
    setPaymentMethod,
    setDeliveryDateIndex,
  } = useCartStore()

  const paymentMethod =
    storedPaymentMethod &&
    enabledPaymentMethods.some((method) => method.name === storedPaymentMethod)
      ? storedPaymentMethod
      : defaultEnabledPaymentMethod

  // The cart store recalculates delivery options from the shipping rates for
  // the entered address. Always prefer them over the global defaults, otherwise
  // the options shown here can differ from the option the cart actually priced.
  const availableDeliveryDates =
    cartDeliveryDates && cartDeliveryDates.length > 0
      ? cartDeliveryDates
      : settingDeliveryDates

  const selectedDeliveryIndex =
    availableDeliveryDates &&
      deliveryDateIndex !== undefined &&
      deliveryDateIndex >= 0 &&
      deliveryDateIndex < availableDeliveryDates.length
      ? deliveryDateIndex
      : availableDeliveryDates && availableDeliveryDates.length > 0
        ? 0
        : -1

  const selectedDelivery =
    selectedDeliveryIndex >= 0
      ? availableDeliveryDates[selectedDeliveryIndex]
      : null

  const isMounted = useIsMounted()

  // Compute the cutoff countdown on the client only (avoids hydration
  // mismatches) and keep it fresh while the customer is on the page.
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
  } | null>(null)

  useEffect(() => {
    const update = () => setTimeLeft(timeUntilMidnight())
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const shippingAddressForm = useForm<ShippingAddress>({
    resolver: zodResolver(ShippingAddressSchema),
    defaultValues:
      shippingAddress ||
      savedAddresses.find((address) => address.isDefault) ||
      savedAddresses[0] ||
      shippingAddressDefaultValues,
  })

  const [isAddressSaving, setIsAddressSaving] = useState(false)

  const onSubmitShippingAddress: SubmitHandler<ShippingAddress> = async (
    values
  ) => {
    if (isAddressSaving) return

    const phone = normalizeSaudiPhone(values.phone)
    if (!phone) {
      toast({
        description: t('Enter a valid Saudi mobile number'),
        variant: 'destructive',
      })
      return
    }
    if (!verifiedPhoneList.includes(phone)) {
      toast({
        description: t('Verify your phone number first'),
        variant: 'destructive',
      })
      return
    }

    setIsAddressSaving(true)
    try {
      // This reprices the cart through a server action and can throw when a
      // product/variant disappeared or the address is not serviceable.
      await setShippingAddress({ ...values, phone })
      setIsAddressSelected(true)
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : 'Unable to save this address. Please review your cart.',
        variant: 'destructive',
      })
    } finally {
      setIsAddressSaving(false)
    }
  }
  // for it to render all inside, isMounted and shippingAddress has to be true.
  // items and router is unnecessary. 
  useEffect(() => {
    if (!isMounted || !shippingAddress) return
    shippingAddressForm.setValue('fullName', shippingAddress.fullName)
    shippingAddressForm.setValue('street', shippingAddress.street)
    shippingAddressForm.setValue('city', shippingAddress.city)
    shippingAddressForm.setValue('country', shippingAddress.country)
    shippingAddressForm.setValue('postalCode', shippingAddress.postalCode)
    shippingAddressForm.setValue('province', shippingAddress.province)
    shippingAddressForm.setValue('district', shippingAddress.district ?? '')
    shippingAddressForm.setValue(
      'nationalAddress',
      shippingAddress.nationalAddress ?? ''
    )
    shippingAddressForm.setValue('phone', shippingAddress.phone)
  }, [items, isMounted, router, shippingAddress, shippingAddressForm])

  const [isAddressSelected, setIsAddressSelected] = useState<boolean>(false)

  const [isPaymentMethodSelected, setIsPaymentMethodSelected] = useState<boolean>(false)

  const [isDeliveryDateSelected, setIsDeliveryDateSelected] = useState<boolean>(false)

  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  // Refresh the persisted cart once on mount so prices/stock/shipping match the
  // database (previously only /cart did this, so /checkout could use a stale
  // localStorage copy until place-order failed). Claim the cart for the signed
  // in user first: a different account on the same browser must not inherit
  // the previous customer's items, address or phone number.
  const hasRefreshedCart = useRef(false)
  useEffect(() => {
    if (!isMounted || hasRefreshedCart.current) return
    hasRefreshedCart.current = true
    setCartOwner(ownerId)
    refreshCart()
  }, [isMounted, ownerId, refreshCart, setCartOwner])

  // A persisted payment method can be disabled after the fact (COD off,
  // provider unconfigured). Write the resolved fallback back to the store so
  // the priced cart (COD fee etc.) matches the method actually submitted.
  useEffect(() => {
    if (!isMounted || !storedPaymentMethod) return
    if (storedPaymentMethod === paymentMethod) return
    setPaymentMethod(paymentMethod).catch((error) => {
      console.error('Unable to update the payment method:', error)
    })
  }, [isMounted, paymentMethod, setPaymentMethod, storedPaymentMethod])

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return

    if (items.length === 0) {
      toast({
        description: 'Your cart is empty',
        variant: 'destructive',
      })
      return
    }

    if (!shippingAddress) {
      toast({
        description: 'Please enter a shipping address',
        variant: 'destructive',
      })
      setIsAddressSelected(false)
      return
    }

    if (!selectedDelivery || selectedDeliveryIndex < 0) {
      toast({
        description: 'Please select a delivery date',
        variant: 'destructive',
      })
      return
    }

    setIsPlacingOrder(true)
    try {
      const res = await createOrder({
        items,
        shippingAddress,
        expectedDeliveryDate: calculateFutureDate(selectedDelivery.daysToDeliver),
        // Send the index the UI actually shows, not the raw store value; the
        // store may still hold a stale index after the rate list changed.
        deliveryDateIndex: selectedDeliveryIndex,
        paymentMethod,
        itemsPrice,
        shippingPrice,
        taxPrice,
        totalPrice,
      })

      if (!res.success) {
        toast({
          description: res.message,
          variant: 'destructive',
        })
        return
      }

      toast({
        description: res.message,
        variant: 'default',
      })
      // Don't clear cart here - it should only be cleared after successful payment
      // The cart will be cleared in the payment success page/webhook
      router.push(`/checkout/${res.data?.orderId}`)
    } finally {
      setIsPlacingOrder(false)
    }
  }
  const handleSelectPaymentMethod = () => {
    setIsAddressSelected(true)
    setIsPaymentMethodSelected(true)
  }
  const handleSelectShippingAddress = () => {
    shippingAddressForm.handleSubmit(onSubmitShippingAddress)()
  }


  const CheckoutSummary = () => (

    <Card>
      <CardContent className='p-4'>
        {!isAddressSelected && (
          <div className='border-b mb-4'>
            <Button
              className='rounded-full w-full'
              onClick={handleSelectShippingAddress}
            >
              {t('Ship to this address')}
            </Button>
            <p className='text-xs text-center py-2'>
              {t('Choose a shipping and payment Paragraph')}
            </p>
          </div>
        )}
        {isAddressSelected && !isPaymentMethodSelected && (
          <div className=' mb-4'>
            <Button
              className='rounded-full w-full'
              onClick={handleSelectPaymentMethod}
            >
              {t('Use this payment method')}
            </Button>

            <p className='text-xs text-center py-2'>
              {t('Choose a payment method Paragraph')}
            </p>
          </div>
        )}
        {isPaymentMethodSelected && isAddressSelected && (
          <div>
            <Button
              onClick={handlePlaceOrder}
              className='rounded-full w-full'
              disabled={isPlacingOrder}
            >
              {isPlacingOrder ? t('Submitting') : t('Place Your Order')}
            </Button>
            <p className='text-xs text-center py-2'>
              {t.rich('agreementNotice', {
                siteName: site.name,
                privacyLink: (chunks) => (
                  <Link href="/page/privacy-policy" className="link">
                    {chunks}
                  </Link>
                ),
                conditionsLink: (chunks) => (
                  <Link href="/page/conditions-of-use" className="link">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        )}

        <div>
          <div className='text-lg font-bold'>{t('Order Summary')}</div>
          <div className='space-y-2'>
            <div className='flex justify-between'>
              <span>{t('Items')}:</span>
              <span>
                <ProductPrice price={itemsPrice} plain convert={false} currencyCode={orderCurrency} />
              </span>
            </div>
            <div className='flex justify-between'>
              <span>{t('Shipping & Handling')}:</span>
              <span>
                {shippingPrice === undefined ? (
                  '--'
                ) : shippingPrice === 0 ? (
                  t('FREE Shipping')
                ) : (
                  <ProductPrice price={shippingPrice} plain convert={false} currencyCode={orderCurrency} />
                )}
              </span>
            </div>
            <div className='flex justify-between'>
              <span>{taxInclusive ? t('VAT (included)') : t('VAT')}:</span>
              <span>
                {taxPrice === undefined ? (
                  '--'
                ) : (
                  <ProductPrice price={taxPrice} plain convert={false} currencyCode={orderCurrency} />
                )}
              </span>
            </div>
            {taxInclusive && (
              <p className='text-muted-foreground text-end text-xs'>
                {t('VAT is included in the displayed prices')}
              </p>
            )}
            {codFee > 0 && (
              <div className='flex justify-between'>
                <span>{t('COD fee')}:</span>
                <span>
                  <ProductPrice
                    price={codFee}
                    plain
                    convert={false}
                    currencyCode={orderCurrency}
                  />
                </span>
              </div>
            )}
            {isPickup && pickupLocation && (
              <p className='text-muted-foreground text-end text-xs'>
                {t('Pickup from')}: {pickupLocation}
              </p>
            )}
            <div className='flex justify-between  pt-4 font-bold text-lg'>
              <span> {t('Order Total')}:</span>
              <span>
                <ProductPrice price={totalPrice} plain convert={false} currencyCode={orderCurrency} />
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // The cart is rehydrated from localStorage on the client. Rendering the form
  // before that completes would compare the server's empty cart with the
  // persisted one (different items, address and prices) during hydration.
  if (!isMounted) {
    return (
      <main className='max-w-6xl mx-auto space-y-4 p-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-40 w-full' />
        <Skeleton className='h-64 w-full' />
      </main>
    )
  }

  return (
    <main className='max-w-6xl mx-auto highlight-link'>
      <div className='grid md:grid-cols-4 gap-6'>
        <div className='md:col-span-3'>
          {/* shipping address */}
          <div>
            {isAddressSelected && shippingAddress ? (
              <div className='grid grid-cols-1 md:grid-cols-12    my-3  pb-3'>
                <div className='col-span-5 flex text-lg font-bold '>
                  <span className='w-8'>1 </span>
                  <span>{t('Shipping address')}</span>
                </div>
                <div className='col-span-5 '>
                  <p>
                    {shippingAddress.fullName} <br />
                    {shippingAddress.street} <br />
                    {`${shippingAddress.city}, ${shippingAddress.province}, ${shippingAddress.postalCode}, ${shippingAddress.country}`}
                  </p>
                </div>
                <div className='col-span-2'>
                  <Button
                    variant={'outline'}
                    onClick={() => {
                      // Editing the address invalidates the downstream
                      // selections: payment/shipping were priced for the old
                      // address, so collapse those steps instead of leaving
                      // them open above the form.
                      setIsAddressSelected(false)
                      setIsPaymentMethodSelected(false)
                      setIsDeliveryDateSelected(false)
                    }}
                  >
                    {t('Change')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className='flex text-primary text-lg font-bold my-2'>
                  <span className='w-8'>1 </span>
                  <span>{t('Enter shipping address')}</span>
                </div>
                {savedAddresses.length > 0 && (
                  <div className='md:ml-8 mb-2'>
                    <Select
                      value=''
                      onValueChange={(id) => {
                        const address = savedAddresses.find(
                          (candidate) => candidate.id === id
                        )
                        if (address)
                          shippingAddressForm.reset(toShippingAddress(address))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('Use a saved address')} />
                      </SelectTrigger>
                      <SelectContent position='popper'>
                        {savedAddresses.map((address) => (
                          <SelectItem
                            key={address.id}
                            value={address.id ?? ''}
                          >
                            {address.fullName} — {address.street},{' '}
                            {address.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Form {...shippingAddressForm}>
                  <form
                    method='post'
                    onSubmit={shippingAddressForm.handleSubmit(
                      onSubmitShippingAddress
                    )}
                    className='space-y-4'
                  >
                    <Card className='md:ml-8 my-4'>
                      <CardContent className='p-4 space-y-2'>
                        <div className='text-lg font-bold mb-2'>
                          {t('Your address')}
                        </div>

                        <div className='flex flex-col gap-5 md:flex-row'>
                          <FormField
                            control={shippingAddressForm.control}
                            name='fullName'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('Full Name')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('Enter full name')}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div>
                          <FormField
                            control={shippingAddressForm.control}
                            name='street'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('Address')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('Enter address')}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className='flex flex-col gap-5 md:flex-row'>
                          <FormField
                            control={shippingAddressForm.control}
                            name='city'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('City')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('Enter city')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name='province'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('Province')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('Enter province')}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name='country'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('Country')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('Enter country')}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className='flex flex-col gap-5 md:flex-row'>
                          <FormField
                            control={shippingAddressForm.control}
                            name='district'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('District')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('Enter district')}
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name='nationalAddress'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('National address')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder='RFKB4744'
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className='flex flex-col gap-5 md:flex-row'>
                          <FormField
                            control={shippingAddressForm.control}
                            name='postalCode'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('Postal Code')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('Enter postal code')}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={shippingAddressForm.control}
                            name='phone'
                            render={({ field }) => (
                              <FormItem className='w-full'>
                                <FormLabel>{t('Phone number')}</FormLabel>
                                <PhoneVerification
                                  value={field.value}
                                  onChange={field.onChange}
                                  verifiedPhones={verifiedPhoneList}
                                  onVerified={(phone) => {
                                    setVerifiedPhoneList((current) =>
                                      current.includes(phone)
                                        ? current
                                        : [...current, phone]
                                    )
                                    field.onChange(phone)
                                  }}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                      <CardFooter className='  p-4'>
                        <Button
                          type='submit'
                          className='rounded-full font-bold'
                          disabled={isAddressSaving}
                        >
                          {isAddressSaving
                            ? t('Saving')
                            : t('Ship to this address')}
                        </Button>
                      </CardFooter>
                    </Card>
                  </form>
                </Form>
              </>
            )}
          </div>
          {/* payment method */}
          <div className='border-y'>
            {isPaymentMethodSelected && paymentMethod ? (
              <div className='grid  grid-cols-1 md:grid-cols-12  my-3 pb-3'>
                <div className='flex text-lg font-bold  col-span-5'>
                  <span className='w-8'>2 </span>
                  <span>{t('Payment Method')}</span>
                </div>
                <div className='col-span-5 '>
                  <p>{paymentMethod}</p>
                </div>
                <div className='col-span-2'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setIsPaymentMethodSelected(false)
                      setIsDeliveryDateSelected(false)
                    }}
                  >
                    {t('Change')}
                  </Button>
                </div>
              </div>
            ) : isAddressSelected ? (
              <>
                <div className='flex text-primary text-lg font-bold my-2'>
                  <span className='w-8'>2 </span>
                  <span>{t('Choose a payment method')}</span>
                </div>
                <Card className='md:ml-8 my-4'>
                  <CardContent className='p-4'>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) => {
                        setPaymentMethod(value).catch((error) => {
                          toast({
                            variant: 'destructive',
                            description:
                              error instanceof Error
                                ? error.message
                                : t('Something went wrong. Please try again.'),
                          })
                        })
                      }}
                    >
                      {enabledPaymentMethods.map((pm) => (
                        <div key={pm.name} className='flex items-center py-1 '>
                          <RadioGroupItem
                            value={pm.name}
                            id={`payment-${pm.name}`}
                          />
                          <Label
                            className='font-bold pl-2 cursor-pointer'
                            htmlFor={`payment-${pm.name}`}
                          >
                            {pm.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                  <CardFooter className='p-4'>
                    <Button
                      onClick={handleSelectPaymentMethod}
                      className='rounded-full font-bold'
                    >
                      {t('Use this payment method')}
                    </Button>
                  </CardFooter>
                </Card>
              </>
            ) : (
              <div className='flex text-muted-foreground text-lg font-bold my-4 py-3'>
                <span className='w-8'>2 </span>
                <span>{t('Choose a payment method')}</span>
              </div>
            )}
          </div>
          {/* items and delivery date */}
          <div>
            {isDeliveryDateSelected && deliveryDateIndex != undefined ? (
              <div className='grid  grid-cols-1 md:grid-cols-12  my-3 pb-3'>
                <div className='flex text-lg font-bold  col-span-5'>
                  <span className='w-8'>3 </span>
                  <span>{t('Items and shipping')}</span>
                </div>
                <div className='col-span-5'>
                  <p>
                    {t('Delivery date')}:{' '}
                    {isMounted && selectedDelivery ? (
                      formatDateTime(
                        calculateFutureDate(selectedDelivery.daysToDeliver)
                      ).dateOnly
                    ) : (
                      <span className="animate-pulse">...</span> // Loading state
                    )}
                  </p>
                  <ul>
                    {items.map((item, _index) => (
                      <li key={_index}>
                        {item.name} x {item.quantity} = {item.price}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className='col-span-2'>
                  <Button
                    variant={'outline'}
                    onClick={() => {
                      setIsPaymentMethodSelected(true)
                      setIsDeliveryDateSelected(false)
                    }}
                  >
                    {t('Change')}
                  </Button>
                </div>
              </div>
            ) : isPaymentMethodSelected && isAddressSelected ? (
              <>
                <div className='flex text-primary  text-lg font-bold my-2'>
                  <span className='w-8'>3 </span>
                  <span>{t('Review items and shipping')}</span>
                </div>
                <Card className='md:ml-8'>
                  <CardContent className='p-4'>
                    <p className='mb-2'>
                      <span className='text-lg font-bold text-green-700'>
                        {t('Arriving')}{' '}
                        {isMounted && selectedDelivery ? (
                          formatDateTime(
                            calculateFutureDate(selectedDelivery.daysToDeliver)
                          ).dateOnly
                        ) : (
                          <span className="animate-pulse">...</span> // Loading state
                        )}
                      </span>{' '}
                      {timeLeft && (
                        <>
                          {t('If you order in the next')}{' '}
                          {timeLeft.hours > 0 && (
                            <>
                              {timeLeft.hours}{' '}
                              {timeLeft.hours === 1 ? t('hour') : t('hours')}
                            </>
                          )}
                          {timeLeft.hours > 0 && timeLeft.minutes > 0 && (
                            <> {t('and')} </>
                          )}
                          {timeLeft.minutes > 0 && (
                            <>
                              {timeLeft.minutes}{' '}
                              {timeLeft.minutes === 1
                                ? t('minute')
                                : t('minutes')}
                            </>
                          )}
                          .
                        </>
                      )}
                    </p>
                    <div className='grid md:grid-cols-2 gap-6'>
                      <div>
                        {items.map((item, _index) => (
                          <div key={_index} className='flex gap-4 py-2'>
                            <div className='relative w-16 h-16'>
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes='20vw'
                                style={{
                                  objectFit: 'contain',
                                }}
                              />
                            </div>

                            <div className='flex-1'>
                              <p className='font-semibold'>
                                {item.name}, {item.color}, {item.size}
                              </p>
                              <p className='font-bold'>
                                <ProductPrice price={item.price} plain convert={false} currencyCode={orderCurrency} />
                              </p>

                              <Select
                                value={item.quantity.toString()}
                                onValueChange={(value) => {
                                  if (value === '0') removeItem(item)
                                  else updateItem(item, Number(value))
                                }}
                              >
                                <SelectTrigger className='w-24'>
                                  <SelectValue>
                                    {t('Qty')}: {item.quantity}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent position='popper'>
                                  {Array.from({
                                    length: item.countInStock,
                                  }).map((_, i) => (
                                    <SelectItem key={i + 1} value={`${i + 1}`}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                  <SelectItem key='delete' value='0'>
                                    {t('Delete')}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className=' font-bold'>
                          <p className='mb-2'> {t('Choose a shipping speed')}:</p>

                          <ul>
                            <RadioGroup
                              value={
                                selectedDeliveryIndex >= 0
                                  ? String(selectedDeliveryIndex)
                                  : ''
                              }
                              onValueChange={(value) => {
                                const index = Number(value)
                                if (Number.isInteger(index)) {
                                  setDeliveryDateIndex(index).catch(
                                    (error) => {
                                      toast({
                                        variant: 'destructive',
                                        description:
                                          error instanceof Error
                                            ? error.message
                                            : t(
                                                'Something went wrong. Please try again.'
                                              ),
                                      })
                                    }
                                  )
                                }
                              }}
                            >
                              {availableDeliveryDates.map((dd, index) => (
                                <div key={`${dd.name}-${index}`} className='flex'>
                                  <RadioGroupItem
                                    value={String(index)}
                                    id={`shipping-speed-${index}`}
                                  />
                                  <Label
                                    className='pl-2 space-y-2 cursor-pointer'
                                    htmlFor={`shipping-speed-${index}`}
                                  >
                                    <div className='font-medium'>
                                      {dd.name === 'Pickup from store'
                                        ? t('Pickup from store')
                                        : t.has(dd.name)
                                          ? t(dd.name)
                                          : dd.name}
                                    </div>
                                    <div className='text-green-700 font-semibold'>
                                      {
                                        formatDateTime(
                                          calculateFutureDate(dd.daysToDeliver)
                                        ).dateOnly
                                      }
                                    </div>
                                    <div>
                                      {(dd.freeShippingMinPrice > 0 &&
                                        itemsPrice >= dd.freeShippingMinPrice
                                        ? 0
                                        : dd.shippingPrice) === 0 ? (
                                        t('FREE Shipping')
                                      ) : (
                                        <ProductPrice
                                          price={dd.shippingPrice}
                                          plain
                                          convert={false}
                                          currencyCode={orderCurrency}
                                        />
                                      )}
                                    </div>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className='flex text-muted-foreground text-lg font-bold my-4 py-3'>
                <span className='w-8'>3 </span>
                <span>{t('Items and shipping')}</span>
              </div>
            )}
          </div>
          {isPaymentMethodSelected && isAddressSelected && (
            <div className='mt-6'>
              <div className='block md:hidden'>
                <CheckoutSummary />
              </div>

              <Card className='hidden md:block '>
                <CardContent className='p-4 flex flex-col md:flex-row justify-between items-center gap-3'>
                  <Button
                    onClick={handlePlaceOrder}
                    className='rounded-full'
                    disabled={isPlacingOrder}
                  >
                    {isPlacingOrder ? t('Submitting') : t('Place Your Order')}
                  </Button>
                  <div className='flex-1'>
                    <p className='font-bold text-lg'>
                      {t('Order Total')}: <ProductPrice price={totalPrice} plain convert={false} currencyCode={orderCurrency} />
                    </p>
                    {displayCurrency !== orderCurrency && (
                      <p className='text-muted-foreground text-xs'>
                        {t('Orders are charged in {currency}', {
                          currency: orderCurrency,
                        })}
                      </p>
                    )}
                    <p className='text-xs'>
                      {' '}
                      {t.rich('agreementNotice', {
                        siteName: site.name,
                        privacyLink: (chunks) => (
                          <Link href="/page/privacy-policy" className="link">
                            {chunks}
                          </Link>
                        ),
                        conditionsLink: (chunks) => (
                          <Link href="/page/conditions-of-use" className="link">
                            {chunks}
                          </Link>
                        ),
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <CheckoutFooter />
        </div>
        <div className='hidden md:block'>
          <CheckoutSummary />
        </div>
      </div>
    </main>
  )
}
export default CheckoutForm
