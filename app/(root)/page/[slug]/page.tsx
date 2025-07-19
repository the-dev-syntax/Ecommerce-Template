import { notFound } from 'next/navigation'
import { getWebPageBySlug } from '@/lib/actions/web-page.actions'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}) {
  const params = await props.params

  const { slug } = params

  const webPage = await getWebPageBySlug(slug)
  if (!webPage) {
    return { title: 'Web page not found' }
  }
  return {
    title: webPage.title,
  }
}

export default async function ProductDetailsPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page: string; color: string; size: string }>
}) {
  const params = await props.params
  const { slug } = params
  const webPage = await getWebPageBySlug(slug)

  if (!webPage) notFound()

  return (
    <div className='w-full max-w-7xl mx-auto px-4'>
       <article className="prose dark:prose-invert w-full max-w-full sm:max-w-2xl md:max-w-5xl px-4 mx-auto">
        <h1>{webPage.title}</h1>       
        <MarkdownRenderer content={webPage.content} />
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