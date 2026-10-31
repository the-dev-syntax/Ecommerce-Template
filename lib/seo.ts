import type { Metadata } from 'next'

import { getSetting } from '@/lib/actions/setting.actions'

import {
  absoluteSiteUrl,
  pageSeoUrls,
  resolveOgImage,
} from './seo-url'

type BuildPageMetadataInput = {
  locale: string
  /** Locale-relative path, e.g. `/product/slug` or `/`. */
  path: string
  title?: string
  description?: string
  images?: string[]
  noIndex?: boolean
}

/**
 * Self-referencing canonical plus page-specific Open Graph/Twitter data. The
 * locale layout no longer sets a canonical, so every public route opts in here
 * instead of inheriting the homepage URL.
 */
export async function buildPageMetadata({
  locale,
  path,
  title,
  description,
  images,
  noIndex,
}: BuildPageMetadataInput): Promise<Metadata> {
  const { site, seo } = await getSetting()
  const { siteUrl, canonical, languages } = pageSeoUrls(locale, path)

  const ogTitle = title ?? site.name
  const ogDescription =
    description || seo.defaultDescription || site.description
  const imageList = (
    images?.filter(Boolean).length
      ? images.filter(Boolean)
      : [resolveOgImage(seo.ogImage)]
  ).map((image) => absoluteSiteUrl(siteUrl, image))

  return {
    ...(title ? { title } : {}),
    description: ogDescription,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: site.name,
      images: imageList.map((url) => ({
        url,
        width: 1200,
        height: 630,
        alt: ogTitle,
      })),
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      site: seo.twitterHandle || undefined,
      title: ogTitle,
      description: ogDescription,
      images: imageList,
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
            googleBot: { index: false, follow: false },
          },
        }
      : {}),
  }
}
