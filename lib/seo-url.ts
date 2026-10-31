import { i18n } from '@/i18n-config'
import { getSiteUrl } from '@/lib/env'
import { localizedPath } from '@/lib/utils'

export const DEFAULT_OG_IMAGE = '/opengraph-image.png'

/** Older settings stored the missing /og-preview.jpg; use the generated image. */
export function resolveOgImage(image?: string | null): string {
  if (!image || image === '/og-preview.jpg') return DEFAULT_OG_IMAGE
  return image
}

export function absoluteSiteUrl(siteUrl: string, value: string): string {
  if (/^https?:\/\//.test(value)) return value
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`
}

/**
 * Canonical URL and hreflang map for a page path. The default locale is
 * unprefixed because next-intl runs with `localePrefix: 'as-needed'`.
 */
export function pageSeoUrls(locale: string, path: string) {
  const siteUrl = getSiteUrl()
  const canonical = `${siteUrl}${localizedPath(locale, path)}`
  const languages = Object.fromEntries(
    i18n.locales.map(({ code }) => [
      code,
      `${siteUrl}${localizedPath(code, path)}`,
    ])
  ) as Record<string, string>

  return { siteUrl, canonical, languages }
}
