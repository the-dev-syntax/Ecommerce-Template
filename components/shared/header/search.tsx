import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { getAllCategories } from '@/lib/actions/product.actions'
import { getSetting } from '@/lib/actions/setting.actions'
import { getTranslations, getLocale } from 'next-intl/server'
import { i18n } from '@/i18n-config'

export default async function Search() {

 const { site: { name } } = await getSetting()
 const t = await getTranslations()
 const locale = await getLocale()
 // A plain <form action> cannot infer the active locale; keep non-default
 // locales on their localized search route.
 const searchAction =
   locale === i18n.defaultLocale ? '/search' : `/${locale}/search`

 const categories = await getAllCategories()

  return (
    <form action={searchAction} method='GET' className='flex  items-stretch h-10 '>
      <Select name='category'>
         <SelectTrigger className='w-auto h-full dark:border-gray-200 bg-gray-100 text-black border-r  rounded-r-none rounded-l-md rtl:rounded-r-md rtl:rounded-l-none  '>
          <SelectValue placeholder={t('All')} />
        </SelectTrigger>
        <SelectContent position='popper'>
          <SelectItem value='all'>{t('All')}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className='flex-1 rounded-none dark:border-gray-200 bg-gray-100 text-black text-base h-full'
         placeholder={t('Search Site', { name })}
        name='q'
        type='search'
      />
      <button
        type='submit'
        className='bg-primary-foreground text-primary rounded-s-none rounded-e-md h-full px-3 py-2 '
      >
        <SearchIcon className='w-6 h-6' />
      </button>
    </form>
  )
}
