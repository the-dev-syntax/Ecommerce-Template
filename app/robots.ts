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

    const getLocalizedPaths = (paths: string[]) => {
        return paths.flatMap(path =>
            locales.map(locale => {
                const prefix = locale === 'en-US' ? '' : `/${locale}`;
                return `${prefix}${path}`;
            })
        );
    };

    return {
        rules: [
        {
            userAgent: '*',
            disallow: [
                ...getLocalizedPaths(disallowedPaths),
                '/api/',
                '/*?*sort=*',                    
                '/*?*tag=*',                  
                '/*?*price=*',                  
                '/*?*rating=*',                  
                '/*?*&*',
                '/*?*oseid=*',
                '/*preview_theme_id*',
                '/*preview_script_id*',
            ]
        },
        {
            userAgent: 'adsbot-google',
            disallow: getLocalizedPaths(adsBotDisallowedPaths),
        },
        {
            userAgent: 'Nutch',
            disallow: '/',
        },
        {
            userAgent: [
                'AhrefsBot',
                'AhrefsSiteAudit',
                'MJ12bot',
                'SemrushBot',
            ],
            crawlDelay: 10,
        },
        {
            userAgent: 'Pinterest',
            crawlDelay: 1,
        },
    ],
        sitemap: `${siteUrl}/sitemap.xml`
    }
}
