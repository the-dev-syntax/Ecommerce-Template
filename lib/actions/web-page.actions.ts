'use server'

import { connectToDatabase } from '@/lib/db'
import { auth } from "@/auth"
import WebPage, { IWebPage } from '../db/models/web-page.model'
import { revalidatePath } from 'next/cache'
import { formatError } from '../utils'


// DELETE WEB PAGE - ADMIN
export const deleteWebPage = async (id:string) => {
    try{
        await (connectToDatabase())
        const session = await auth()
        if(session?.user.role !== "Admin")
            throw new Error('Admin permission required')

        const res = await WebPage.findByIdAndDelete(id)
        if (!res) throw new Error('Web page not found')
        
         revalidatePath('/admin/web-pages')
        return {
         success: true,
         message: 'Web page deleted successfully',   
        }

    } catch (error) {
        return { success: false, message: formatError(error) }
      }
}

// GET ALL WEB PAGES - ADMIN
export const getAllWebPages = async () => {

  await connectToDatabase()

  const session = await auth()
  if(session?.user.role !== "Admin")
  throw new Error('Admin permission required')

  const WebPages = await WebPage.find()
  if (!WebPages) throw new Error('WebPages not found')

  return JSON.parse(JSON.stringify(WebPages)) as IWebPage[]
}

// GET ONE WEB PAGE BY ID - PUBLIC
export async function getWebPageById(webPageId: string) {
  await connectToDatabase()

  const webPage = await WebPage.findById(webPageId)
   if (!webPage) throw new Error('WebPage not found')

  return JSON.parse(JSON.stringify(webPage)) as IWebPage
}

// GET ONE PAGE BY SLUG - PUBLIC
export async function getWebPageBySlug(slug: string) {
  await connectToDatabase()

  const webPage = await WebPage.findOne({ slug, isPublished: true })
  if (!webPage) throw new Error('WebPage not found')

  return JSON.parse(JSON.stringify(webPage)) as IWebPage
}