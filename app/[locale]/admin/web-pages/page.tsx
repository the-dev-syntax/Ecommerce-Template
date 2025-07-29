import Link from 'next/link'

import DeleteDialog from '@/components/shared/delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatId } from '@/lib/utils'
import { deleteWebPage, getAllWebPages } from '@/lib/actions/web-page.actions'
import { IWebPage } from '@/lib/db/models/web-page.model'
import { getTranslations } from 'next-intl/server'


export async function generateMetadata(){
  const t = await getTranslations('Admin')
  return {
    title: t('Admin WebPage'),
  }
}

export default async function WebPageAdminPage() {
  const webPages = await getAllWebPages()
  const t = await getTranslations('Admin')

    if (!webPages || webPages.length === 0) {
        return (
        <div className='flex h-full items-center justify-center'>
            <h1 className='text-2xl font-bold'>{t('No WebPages Found')}</h1>
        </div>
        )
    }

  return (
    <div className='space-y-2'>
      <div className='flex-between'>
        <h1 className='h1-bold'>{t('WebPages')}</h1>
        <Button asChild variant='default'>
          <Link href='/admin/web-pages/create'>{t('Create WebPage')}</Link>
        </Button>
      </div>
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[100px]'>{t('Id')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Slug')}</TableHead>
              <TableHead>{t('IsPublished')}</TableHead>
              <TableHead className='w-[100px]'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webPages.map((webPage: IWebPage) => (
              <TableRow key={webPage._id}>
                <TableCell>{formatId(webPage._id)}</TableCell>
                <TableCell>{webPage.title}</TableCell>
                <TableCell>{webPage.slug}</TableCell>
                <TableCell>{webPage.isPublished ? 'Yes' : 'No'}</TableCell>
                <TableCell className='flex gap-1'>
                  <Button asChild variant='outline' size='sm'>
                    <Link href={`/admin/web-pages/${webPage._id}`}>{t('Edit')}</Link>
                  </Button>
                  <DeleteDialog id={webPage._id} action={deleteWebPage} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}