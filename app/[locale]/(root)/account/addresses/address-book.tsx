'use client'

import { useState } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  deleteUserAddress,
  saveUserAddress,
  setDefaultUserAddress,
} from '@/lib/actions/address.actions'
import { UserAddressSchema } from '@/lib/validator'
import type { UserAddress } from '@/types'

const emptyAddress: UserAddress = {
  fullName: '',
  phone: '',
  street: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Saudi Arabia',
  district: '',
  nationalAddress: '',
  isDefault: false,
}

export default function AddressBook({
  initialAddresses,
}: {
  initialAddresses: UserAddress[]
}) {
  const t = useTranslations()
  const { toast } = useToast()
  const [addresses, setAddresses] = useState(initialAddresses)
  const [editing, setEditing] = useState<UserAddress | null>(null)
  const [showForm, setShowForm] = useState(false)

  const form = useForm<UserAddress>({
    resolver: zodResolver(UserAddressSchema),
    defaultValues: emptyAddress,
  })

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    form.reset(emptyAddress)
  }

  const startAdd = () => {
    setEditing(null)
    form.reset(emptyAddress)
    setShowForm(true)
  }

  const startEdit = (address: UserAddress) => {
    setEditing(address)
    form.reset(address)
    setShowForm(true)
  }

  const onSubmit = async (values: UserAddress) => {
    const result = await saveUserAddress({ ...values, id: editing?.id })
    if (!result.success) {
      toast({ variant: 'destructive', description: result.message })
      return
    }
    setAddresses(result.data ?? [])
    closeForm()
    toast({ description: result.message })
  }

  const onDelete = async (id: string) => {
    if (!window.confirm(t('Delete this address?'))) return
    const result = await deleteUserAddress(id)
    if (!result.success) {
      toast({ variant: 'destructive', description: result.message })
      return
    }
    setAddresses(result.data ?? [])
    toast({ description: result.message })
  }

  const onSetDefault = async (id: string) => {
    const result = await setDefaultUserAddress(id)
    if (!result.success) {
      toast({ variant: 'destructive', description: result.message })
      return
    }
    setAddresses(result.data ?? [])
    toast({ description: result.message })
  }

  return (
    <div className='space-y-4'>
      <div>
        <Button type='button' onClick={startAdd}>
          <PlusIcon className='mr-2 h-4 w-4' />
          {t('Add address')}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className='p-4'>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-4'
              >
                <div className='grid gap-4 md:grid-cols-2'>
                  <AddressField form={form} name='fullName' label={t('Full Name')} />
                  <AddressField form={form} name='phone' label={t('Phone number')} />
                  <AddressField form={form} name='country' label={t('Country')} />
                  <AddressField form={form} name='province' label={t('Province')} />
                  <AddressField form={form} name='city' label={t('City')} />
                  <AddressField form={form} name='district' label={t('District')} />
                  <AddressField form={form} name='street' label={t('Street')} />
                  <AddressField form={form} name='postalCode' label={t('Postal Code')} />
                  <AddressField
                    form={form}
                    name='nationalAddress'
                    label={t('National address')}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='isDefault'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center gap-2 space-y-0'>
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </FormControl>
                      <FormLabel className='!mt-0'>
                        {t('Set as default')}
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <div className='flex gap-2'>
                  <Button type='submit' disabled={form.formState.isSubmitting}>
                    {t('Save Changes')}
                  </Button>
                  <Button type='button' variant='outline' onClick={closeForm}>
                    {t('Cancel')}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {addresses.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          {t('No saved addresses yet')}
        </p>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          {addresses.map((address, index) => (
            <Card key={address.id ?? index}>
              <CardContent className='space-y-2 p-4'>
                <div className='flex items-center justify-between gap-2'>
                  <h2 className='font-bold'>{address.fullName}</h2>
                  {address.isDefault && <Badge>{t('Default')}</Badge>}
                </div>
                <p className='text-sm text-muted-foreground'>
                  {[
                    address.street,
                    address.district,
                    address.city,
                    address.province,
                    address.postalCode,
                    address.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className='text-sm'>{address.phone}</p>
                {address.nationalAddress && (
                  <p className='text-sm text-muted-foreground'>
                    {t('National Address')}: {address.nationalAddress}
                  </p>
                )}
                <div className='flex flex-wrap gap-2 pt-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => startEdit(address)}
                  >
                    <PencilIcon className='mr-1 h-4 w-4' />
                    {t('Edit')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={!!address.isDefault}
                    onClick={() => onSetDefault(address.id ?? '')}
                  >
                    <StarIcon className='mr-1 h-4 w-4' />
                    {t('Set as default')}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='destructive'
                    onClick={() => onDelete(address.id ?? '')}
                  >
                    <Trash2Icon className='mr-1 h-4 w-4' />
                    {t('Delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

type AddressTextField =
  | 'fullName'
  | 'phone'
  | 'country'
  | 'province'
  | 'city'
  | 'district'
  | 'street'
  | 'postalCode'
  | 'nationalAddress'

type AddressFieldProps = {
  form: UseFormReturn<UserAddress>
  name: AddressTextField
  label: string
}

function AddressField({ form, name, label }: AddressFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={field.value ?? ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
