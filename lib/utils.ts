import { clsx, type ClassValue } from 'clsx'
// import { CloudCog } from 'lucide-react'
// import { collectMeta } from 'next/dist/build/utils'
// import { cloneElement } from 'react'
import { twMerge } from 'tailwind-merge'
import qs from 'query-string'
import { nanoid } from 'nanoid'
import crypto from 'crypto'



export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// the above came by default with nextjs and tailwind installation.

export const formatNumberWithDecimal = (num: number): string => {
  const [int, decimal] = num.toString().split('.')
  return decimal ? `${int}.${decimal.padEnd(2, '0')}` : int
}


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

// generate a unique id for each item
export const generateId = () => nanoid()


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

export function getMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const date = new Date(year, month - 1)
  const monthName = date.toLocaleString('default', { month: 'long' })
  const now = new Date()

  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    return `${monthName} (ongoing)`
  }
  return monthName
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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex') // raw token to email
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex') // store in DB
  return { token, hashedToken }
}

// COMPARING RECEIVED TOKEN:
// const hashedReceivedToken = crypto.createHash('sha256').update(receivedToken).digest('hex');
// const user = await User.findOne({ verificationToken: hashedReceivedToken });


// FOR PASSWORD RESET:
// export function generatePasswordResetToken() {
//   const token = crypto.randomBytes(32).toString('hex') // raw token to email
//   const hashedToken = crypto.createHash('sha256').update(token).digest('hex') // store in DB
//   return { token, hashedToken }
// }