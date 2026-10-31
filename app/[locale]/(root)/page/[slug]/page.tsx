import { notFound } from 'next/navigation'
import { getWebPageBySlug } from '@/lib/actions/web-page.actions'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { getSetting } from '@/lib/actions/setting.actions';
import { buildPageMetadata } from '@/lib/seo';

// Force dynamic rendering - this page depends on database queries
export const dynamic = 'force-dynamic'


export async function generateMetadata(props: {
  params: Promise<{ slug: string; locale: string }>
}) {
  const params = await props.params

  const { slug, locale } = params
  const webPage = await getWebPageBySlug(slug)
  if (!webPage) {
    return {
      title: 'Web page not found',
      robots: { index: false, follow: false },
    }
  }
  return buildPageMetadata({
    locale,
    path: `/page/${slug}`,
    title: webPage.title,
    description: webPage.content.slice(0, 160),
  })
}

export default async function ProductDetailsPage(props: {
  params: Promise<{ slug: string }>
  // searchParams: Promise<{ page: string; color: string; size: string }>
}) {
  const params = await props.params
  const { slug } = params

  const [ webPage, settings ] = await Promise.all([
    getWebPageBySlug(slug),
    getSetting(),
  ]);

  if (!webPage) notFound(); 
  
  const siteName = settings.site.name ?? 'Our Site'; 

  const dynamicContent = webPage.content.replace(/{{appName}}/g, siteName);
  
  return (
    <div className='w-full max-w-7xl mx-auto px-4 min-h-screen'>
       <article className="prose dark:prose-invert w-full max-w-full sm:max-w-2xl md:max-w-5xl px-4 mx-auto">
        <h1>{webPage.title}</h1>       
        <MarkdownRenderer content={dynamicContent} />
      </article>
    </div>
  )
}

/*
<MDEditor
          value={webPage.content}                               
          previewOptions={{
              rehypePlugins: [[rehypeSanitize, secureSchema]],
          }}
          style={{ width: '100%' }}          
        />
*/
