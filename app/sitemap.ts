import type { MetadataRoute } from 'next'
import { i18n } from '@/i18n-config' 
import { getAllProductsForSitemap } from '@/lib/actions/product.actions';
import { getAllWebPagesForSitemap } from '@/lib/actions/web-page.actions';




export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = i18n.locales.map((locale) => locale.code);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const products = await getAllProductsForSitemap()

  const webPages = await getAllWebPagesForSitemap();

  const staticPaths = [ '', '/search', '/cart'];

  const staticUrls = staticPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${(locale === 'en-US' ? '' : locale)}${path}`,
      lastModified: new Date(), // Use a fixed date or dynamically fetch the last modified date
      changeFrequency: 'monthly' as const,
      priority: path === '' ? 1.0 : 0.8, // Homepage gets higher priority
    }))
  );



  const productUrls = products.flatMap((product) =>
    locales.map((locale) => ({   // if the products are localized, you can add locale to the URL
      url: `${siteUrl}/${(locale === 'en-US' ? '' : locale)}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: 'monthly' as const, 
      priority: 0.7,
    }))
  );

  const webPageUrls = webPages.flatMap((page) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${(locale === 'en-US' ? '' : locale)}/page/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'yearly' as const, // Content pages like 'about-us' rarely change
      priority: 0.5,
    }))
  );

    return [
       ...staticUrls,
       ...productUrls,
       ...webPageUrls,
 
    ]
}
