"use server";
import { revalidatePath } from 'next/cache';
import { i18n } from '@/i18n-config';

export async function revalidateAllLocales(path: string) {
  for (const locale of i18n.locales) {
    revalidatePath(`/${locale.code}${path}`);
  }
}
