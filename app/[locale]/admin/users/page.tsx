import Link from 'next/link'
import { auth } from '@/auth'
import DeleteDialog from '@/components/shared/delete-dialog'
import Pagination from '@/components/shared/pagination'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deleteUser, getAllUsers } from '@/lib/actions/user.actions'
import { IUser } from '@/lib/db/models/user.model'
import { formatId } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'



export async function generateMetadata() {
  const t = await getTranslations('Admin')
  return {
    title: t('Admin Users'),
  }
}


export default async function AdminUser(props: {
  searchParams: Promise<{ page: string }>
}) {
  const searchParams = await props.searchParams

  const t = await getTranslations('Admin')

  const session = await auth()
  if (session?.user.role !== 'Admin')
    throw new Error('Admin permission required')

  const page = Number(searchParams.page) || 1

  const users = await getAllUsers({ page })

  if (!users.data){
    return (
      <div className='space-y-2'>
        <h1 className='h1-bold'>{t('Users')}</h1>
        <p className='text-destructive'>{t('Error loading users: Problem with Auth or Database Connection.')}</p>
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      <h1 className='h1-bold'>{t('Users')}</h1>
      <div>       
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Id')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Email')}</TableHead>
              <TableHead>{t('Role')}</TableHead>
              <TableHead>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user: IUser) => (
              <TableRow key={user._id}>
                <TableCell>{formatId(user._id)}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell className='flex gap-1'>
                  <Button asChild variant='outline' size='sm'>
                    <Link href={`/admin/users/${user._id}`}>{t('Edit')}</Link>
                  </Button>
                  <DeleteDialog id={user._id} action={deleteUser} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {users.totalPages > 1 && (
          <Pagination page={page} totalPages={users.totalPages} />
        )}
      </div>
    </div>
  )
}