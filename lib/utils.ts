import { clsx, type ClassValue } from 'clsx'
// import { CloudCog } from 'lucide-react'
// import { collectMeta } from 'next/dist/build/utils'
// import { cloneElement } from 'react'
import { twMerge } from 'tailwind-merge'
import qs from 'query-string'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// the above came by default with nextjs and tailwind installation.

export const formatNumberWithDecimal = (num: number): string => {
  const [int, decimal] = num.toString().split('.')
  return decimal ? `${int}.${decimal.padEnd(2, '0')}` : int
}

// PROMPT: [ChatGTP] create toSlug ts arrow function that convert text to lowercase, remove non-word, non-whitespace, non-hyphen characters, replace whitespace, trim leading hyphens and trim trailing hyphens
// PROMPT: [ChatGTP] last line only :non-whitespace, non-hyphen characters, replace whitespace, trim leading hyphens and trim trailing hyphens  - non-whitespace, non-hyphen characters, replace whitespace, trim leading hyphens and trim trailing hyphens.- Also replace repeated hyphens in middle with single hyphen
// export const toSlug = (text: string): string =>
//   text
//     .toLowerCase()
//     .replace(/[^\w\s-]+/g, '')
//     .replace(/\s+/g, '-')
//     .replace(/^-+|-+$/g, '')
//     .replace(/-+/g, '-')
// .replace(/[^\p{L}\p{N}\-]+/gu, '') // Use Unicode-aware regex for arabic and other languages.

export const slugify = (text: string): string => {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Spaces to dashes
    .replace(/[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\-]+/g, '') // Allow Arabic + Latin + dashes
    .replace(/\-\-+/g, '-') // Collapse multiple dashes
    .replace(/^-+|-+$/g, '') // Trim leading/trailing dashes
    .slice(0, 80);
}

// call in these exported fns to formate the prices
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
  minimumFractionDigits: 2,
})

export function formatCurrency(amount: number) {
  return CURRENCY_FORMATTER.format(amount)
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US')

export function formatNumber(number: number) {
  return NUMBER_FORMATTER.format(number)
}

export const round2 = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100

// not secure use uuid or nanoid
export const generateId = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)).join('')

// 1- zod error , then 2- mongoose validation error ,then 3- mongoDB error for doublicate key , 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatError = (error: any): string => {
  if (error.name === 'ZodError') {
    const fieldErrors = Object.keys(error.errors).map((field) => {
      const errorMessage = error.errors[field].message
      return `${error.errors[field].path}: ${errorMessage}` // field: errorMessage
    })
    return fieldErrors.join('. ')
  } else if (error.name === 'ValidationError') {
    const fieldErrors = Object.keys(error.errors).map((field) => {
      const errorMessage = error.errors[field].message
      return errorMessage
    })
    return fieldErrors.join('. ')
  } else if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyValue)[0]
    return `${duplicateField} already exists`
  } else {
    // return 'Something went wrong. please try again'
    return typeof error.message === 'string'
      ? error.message
      : JSON.stringify(error.message)
  }
}
// checkout cart utility fns:
// rename currentDate futureDate
export function calculateFutureDate(days: number) {
  const currentDate = new Date()
  currentDate.setDate(currentDate.getDate() + days)
  return currentDate
}

export function getMonthName(yearAndMonth: string) {
  
  const [year, monthNumber] = yearAndMonth.split('-')

  const date = new Date()

  console.log(year)

  date.setMonth(parseInt(monthNumber) - 1)
  
  return new Date().getMonth() === parseInt(monthNumber) - 1
    ? `${date.toLocaleString('default', { month: 'long' })} (ongoing)`
    : date.toLocaleString('default', { month: 'long' })
}

// rename currentDate pastDate
export function calculatePastDate(days: number) {
  const currentDate = new Date()
  currentDate.setDate(currentDate.getDate() - days)
  return currentDate
}

export function timeUntilMidnight(): { hours: number; minutes: number } {
  const now = new Date()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0) // Set to 12:00 AM (next day)

  const diff = midnight.getTime() - now.getTime() // Difference in milliseconds
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { hours, minutes }
}

export const formatDateTime = (dateString: Date) => {
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    month: 'short', // abbreviated month name (e.g., 'Oct')
    year: 'numeric', // abbreviated month name (e.g., 'Oct')
    day: 'numeric', // numeric day of the month (e.g., '25')
    hour: 'numeric', // numeric hour (e.g., '8')
    minute: 'numeric', // numeric minute (e.g., '30')
    hour12: true, // use 12-hour clock (true) or 24-hour clock (false)
  }
  const dateOptions: Intl.DateTimeFormatOptions = {
    // weekday: 'short', // abbreviated weekday name (e.g., 'Mon')
    month: 'short', // abbreviated month name (e.g., 'Oct')
    year: 'numeric', // numeric year (e.g., '2023')
    day: 'numeric', // numeric day of the month (e.g., '25')
  }
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric', // numeric hour (e.g., '8')
    minute: 'numeric', // numeric minute (e.g., '30')
    hour12: true, // use 12-hour clock (true) or 24-hour clock (false)
  }
  const formattedDateTime: string = new Date(dateString).toLocaleString('en-US', dateTimeOptions )
  const formattedDate: string = new Date(dateString).toLocaleString( 'en-US', dateOptions )
  const formattedTime: string = new Date(dateString).toLocaleString('en-US', timeOptions )

  return {
    dateTime: formattedDateTime,
    dateOnly: formattedDate,
    timeOnly: formattedTime,
  }
}
// return the last 6 digits of the id and add .. before it = ..45sd5s
export function formatId(id: string) {
  return `..${id.substring(id.length - 6)}`
}


export function formUrlQuery({
  params,
  key,
  value,
}: {
  params: string
  key: string
  value: string | null
}) {
  const currentUrl = qs.parse(params)

  currentUrl[key] = value

  return qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: currentUrl,
    },
    { skipNull: true }
  )
}

export const getFilterUrl = ({
  params,
  category,
  tag,
  sort,
  price,
  rating,
  page,
}: {
  params: {
    q?: string  // query:term typed into a search bar.
    category?: string
    tag?: string
    sort?: string
    price?: string
    rating?: string
    page?: string
  }
  category?: string
  tag?: string
  sort?: string
  price?: string
  rating?: string
  page?: string
}) => {
  const newParams = { ...params }
  if (category) newParams.category = category
  if (tag) newParams.tag = slugify(tag)
  if (sort) newParams.sort = sort
  if (price) newParams.price = price
  if (rating) newParams.rating = rating
  if (page) newParams.page = page
  return `/search?${new URLSearchParams(newParams).toString()}`
}

