'use server'

import { auth } from '@/auth'
import { requireAdmin } from '@/lib/access'
import { formatError } from '@/lib/utils'
import { revalidateAllLocales } from '@/lib/utils-serverOnly'
import { retryZatcaSubmission } from '@/lib/zatca/service'

export async function retryZatcaInvoice(invoiceId: string) {
  try {
    requireAdmin(await auth())
    await retryZatcaSubmission(invoiceId)
    await revalidateAllLocales('/admin/orders')
    return { success: true, message: 'ZATCA submission retried' }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}
