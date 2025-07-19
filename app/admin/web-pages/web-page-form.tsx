'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import ReactMarkdown from 'react-markdown'; 

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { createWebPage, updateWebPage } from '@/lib/actions/web-page.actions'
import { IWebPage } from '@/lib/db/models/web-page.model'
import { WebPageInputSchema } from '@/lib/validator'
import { Checkbox } from '@/components/ui/checkbox'
import { slugify } from '@/lib/utils'
import { IWebPageInput} from '@/types'
import { useEffect } from 'react'
import { secureSchema } from '@/lib/markdown-config'
import { Textarea } from '@/components/ui/textarea';
import rehypeSanitize from 'rehype-sanitize';


const webPageDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
        title: 'Sample Page',
        slug: 'sample-page',
        content: 'Sample Content',
        isPublished: true,
      }
    : {
        title: '',
        slug: '',
        content: '',
        isPublished: false,
      }

const WebPageForm = ({
  type,
  webPage,
  webPageId,
}: {
  type: 'Create' | 'Update'
  webPage?: IWebPage
  webPageId?: string
}) => {
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<IWebPageInput>({
    resolver: zodResolver(WebPageInputSchema),
    defaultValues:
      webPage && type === 'Update' ? webPage : webPageDefaultValues,
  })
 
  async function onSubmit(values: IWebPageInput) {
    if (type === 'Create') {
      const res = await createWebPage(values)
      if (!res.success) {
        toast({
          variant: 'destructive',
          description: res.message,
        })
      } else {
        toast({
          description: res.message,
        })
        router.push(`/admin/web-pages`)
      }
    }
    if (type === 'Update') {
      if (!webPageId) {
        router.push(`/admin/web-pages`)
        return
      }
      const res = await updateWebPage({ ...values, _id: webPageId })
      if (!res.success) {
        toast({
          variant: 'destructive',
          description: res.message,
        })
      } else {
        router.push(`/admin/web-pages`)
      }
    }
  }

  //Auto-generate slug from title
  const watchedTitle = form.watch('title')
  useEffect(() => {
    // Only update the slug if the user hasn't typed in it manually
    // We check this by comparing the current slug with a slugified version of itself.
    // If they match, it means it's either empty or was auto-generated.
    const currentSlug = form.getValues('slug')
    if (currentSlug === slugify(currentSlug)) {
      form.setValue('slug', slugify(watchedTitle), { shouldValidate: true })
    }
  }, [watchedTitle, form])

  return (
    <Form {...form}>
      <form
        // method='post'
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-8'
      >
        <div className='flex flex-col gap-5 md:flex-row'>
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder='Enter title' {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='slug'
            render={({ field }) => (
              <FormItem className='w-full'>
                <FormLabel>Slug</FormLabel>

                <FormControl>
                  <div className='relative'>
                    <Input
                      aria-label="Regenerate slug"
                      placeholder='Enter slug'
                      className='pl-8'
                      {...field}
                    />
                    <button
                      type='button'
                      onClick={() => {
                        form.setValue('slug', slugify(form.getValues('title')))
                      }}
                      className='absolute right-2 top-2.5'
                    >
                      Generate
                    </button>
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className='flex flex-col gap-5'>
        <FormField
            control={form.control}
            name='content'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Page Content</FormLabel>
               
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 '>       
                 <div className='flex flex-col gap-2 '>
                    <h3 className='text-sm font-medium'>Editor</h3>
                    <FormControl>                      
                      <Textarea
                        placeholder='Enter your content in Markdown format...'
                        className='min-h-[300px]' // Give it some height
                        {...field}
                      />
                    </FormControl>                   
                    <FormMessage />
                  </div>
                  <div className='flex flex-col gap-2'>
                    <h3 className='text-sm font-medium'>Preview</h3>
                    <div className='prose dark:prose-invert min-h-[300px] min-w-full rounded-md border bg-muted p-4'>
                      {/* ReactMarkdown is for display only. It reads the value from the form field. */}
                      <ReactMarkdown rehypePlugins={[[rehypeSanitize, secureSchema]]}>
                        {/* Provide a default value to avoid errors if field.value is empty */}
                        {field.value || '_Nothing to preview yet..._'}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </FormItem>
            )}
          />
        </div>
        <div>
          <FormField
            control={form.control}
            name='isPublished'
            render={({ field }) => (
              <FormItem className='space-x-2 items-center'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(val) => field.onChange(Boolean(val))}
                  />
                </FormControl>
                <FormLabel>Is Published?</FormLabel>
              </FormItem>
            )}
          />
        </div>
        <div>
          <Button
            type='submit'
            size='lg'
            disabled={form.formState.isSubmitting}
            className='button col-span-2 w-full'
          >
            {form.formState.isSubmitting ? 'Submitting...' : `${type} Page `}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default WebPageForm

/*
<ReactMarkdown                  
                    value={field.value}
                    style={{ height: '500px' }}
                    onChange={(val) => field.onChange(val || '')}
                    {...mdEditorConfig}
                  />
                   {<Textarea placeholder='Enter content' {...field} />  }               
*/