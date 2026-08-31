'use client'

import { useRef, useState } from 'react'
import { useUploadThing } from '@/lib/uploadthing'
import { useTranslations } from 'next-intl'

export default function ImageUploader({
  existingImages,
  onUploaded,
  multiple = true,
  maxFiles = 10,
}: {
  existingImages: string[]
  onUploaded: (urls: string[]) => void
  multiple?: boolean
  maxFiles?: number

}) {
  const t = useTranslations('Form')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { startUpload } = useUploadThing('imageUploader')

  const uploadFiles = async (files: File[]) => {
    setError(null)

    const maxSize = 4 * 1024 * 1024 // 4MB, matches core.ts
    const remaining = maxFiles - existingImages.length
    if (files.length > remaining) {
      setError(t('Max 10 images'))
      return
    }
    const bad = files.find((f) => !f.type.startsWith('image/') || f.size > maxSize)
    if (bad) {
      setError(`${bad.name}: image must be under 4MB`)
      return
    }

    setIsUploading(true)
    try {
      const res = await startUpload(files)
      if (res) onUploaded(res.map((f) => f.ufsUrl))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragActive(true)
      }}
      onDragLeave={() => setIsDragActive(false)}

      onDrop={(e) => {
        e.preventDefault()
        setIsDragActive(false)
        if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files))
      }}

      onClick={() => inputRef.current?.click()}

      className={`flex min-h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        isDragActive ? 'border-blue-500 bg-blue-600/10' : 'border-gray-400'
      }`}
    >
      <input
        ref={inputRef}
        type='file'
        multiple={multiple}
        accept='image/*'
        className='hidden'
        onChange={(e) => {
          if (e.target.files) uploadFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      <div>{isUploading ? t('Uploading') : t('Drag and Drop')}</div>
      <div className='text-xs text-muted-foreground'>
        {t('Only images are allowed, 10 max')}
      </div>
      {error && (
        <div className='mt-2 text-sm font-semibold text-destructive'>
          {error}
        </div>
      )}
    </div>
  )
}