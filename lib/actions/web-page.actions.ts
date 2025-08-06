'use server'

import { connectToDatabase } from '@/lib/db'
import { auth } from "@/auth"
import WebPage, { IWebPage } from '../db/models/web-page.model'
import { revalidatePath } from 'next/cache'
import { formatError } from '../utils'
import { IWebPageInput, IWebPageUpdate } from '@/types'
import { WebPageInputSchema, WebPageUpdateSchema } from '../validator'


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
// GET ALL PAGES SLUGS - PUBLIC
export async function getAllWebPageSlugs() {
  await connectToDatabase()

  // const slugs = await WebPage.find({}, 'slug -_id'); or 
  const slugs = await WebPage.find().select({ slug: 1, _id: 0 });

  if (!slugs) throw new Error('WebPage not found')

  return JSON.parse(JSON.stringify(slugs)) 
}

// CREATE WEB PAGE - ADMIN
export async function createWebPage(data: IWebPageInput) {

    const session = await auth()
    if(session?.user.role !== "Admin")
    throw new Error('Admin permission required')

 try {
    const webPage = WebPageInputSchema.parse(data)
    await connectToDatabase()
    // avoid doublicating slugs which will prevent fetching the page and cause errors

    await WebPage.create(webPage)
    revalidatePath('/admin/web-pages')

    return {
      success: true,
      message: 'WebPage created successfully',
    }

  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

// UPDATE WEB PAGE - ADMIN
export async function updateWebPage(data: IWebPageUpdate) {
    try{
    const webPage = WebPageUpdateSchema.parse(data)

    await connectToDatabase()

    const session = await auth()
    if(session?.user.role !== "Admin")
    throw new Error('Admin permission required')

    // return the new updated page (webPage._id, webPage, { new: true })
    const updatedPage  = await WebPage.findByIdAndUpdate(webPage._id, webPage)
    if (!updatedPage ) throw new Error('WebPage not found. Could not perform update.')

    revalidatePath('/admin/web-pages')
    
    return {
      success: true,
      message: 'WebPage updated successfully',
    }
  } catch (error){
     return { success: false, message: formatError(error) }
  }
}

// GET ALL WEB PAGES FOR SITEMAP - PUBLIC
export async function getAllWebPagesForSitemap() {
  await connectToDatabase()
  const webPages = await WebPage.find({ isPublished: true }, 'slug updatedAt')
    .sort({ updatedAt: -1 })
    .lean()

  if (!webPages) throw new Error('WebPages not found')

  return JSON.parse(JSON.stringify(webPages)) as { slug: string; updatedAt: Date }[]
}
