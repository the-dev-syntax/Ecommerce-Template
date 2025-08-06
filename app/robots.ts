import type { MetadataRoute } from 'next'
import { i18n } from '@/i18n-config' 
 
export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const locales = i18n.locales.map((locale) => locale.code);
     const disallowedPaths = [
        '/auth',
        '/admin',
        '/api/',
        '/checkout',
        '/account',
        '/cart',
        '/sign-in',
        '/sign-up',
        '/register',
        '/login',
        '/orders',
     ];

      // Paths to disallow for the Google Ads bot (it needs to see products, but not the checkout funnel)
    const adsBotDisallowedPaths = [
        '/cart',
        '/checkout',
        '/orders',
        '/sign-in',
        '/sign-up',
    ];

    // const disallowedPathsWithLocale = disallowedPaths.flatMap((path) =>
    //   locales.map((locale) => `${locale === 'en-US' ? '' : "/" + locale}${path}`)
    // );
    
    const getLocalizedPaths = (paths: string[]) => {
        return paths.flatMap(path =>
            locales.map(locale => {
                // Default 'en-US' locale has no prefix, others do.
                const prefix = locale === 'en-US' ? '' : `/${locale}`;
                return `${prefix}${path}`;
            })
        );
    };

    return {
        rules: [
        {
            userAgent: '*',
            allow: '/',
            disallow: [
                ...getLocalizedPaths(disallowedPaths),
                '/api/',
                '/*?*sort=*',                    
                '/*?*tag=*',                  
                '/*?*price=*',                  
                '/*?*rating=*',                  
                // Blocks URLs from faceted navigation/filtering. e.g., /search?color=blue&size=large
                // The '*?*&' pattern blocks any URL with more than one query parameter, a common
                // source of infinite crawlable URLs.
                '/*?*&*',
                // Blocks specific tracking & preview parameters that create duplicate pages
                '/*?*oseid=*',
                '/*preview_theme_id*',
                '/*preview_script_id*',
            ]
        },
        {
                userAgent: 'adsbot-google',
                disallow: getLocalizedPaths(adsBotDisallowedPaths),
            },

            // Rule Group 3: Block specific, non-essential crawlers completely
            {
                userAgent: 'Nutch',
                disallow: '/',
            },
            
            // Rule Group 4: Throttle aggressive but potentially useful SEO crawlers
            {
                userAgent: [
                    'AhrefsBot',
                    'AhrefsSiteAudit',
                    'MJ12bot',
                    'SemrushBot', // Added Semrush as it's another common one
                ],
                // Ask these bots to wait 10 seconds between requests to protect server resources
                crawlDelay: 10,
            },

            // Rule Group 5: Be lenient with high-value social media bots
            {
                userAgent: 'Pinterest',
                crawlDelay: 1, // A short delay is still a good practice
            },
    ],
        sitemap: `${siteUrl}/sitemap.xml`

    }
}
