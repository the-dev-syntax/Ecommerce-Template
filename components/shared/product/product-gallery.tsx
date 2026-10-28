'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageOffIcon } from 'lucide-react'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

export default function ProductGallery({ images }: { images: string[] }) {
  const [selectedImage, setSelectedImage] = useState(0)
  const hasImages = images.length > 0
  // Keep the index in range if the gallery re-renders with fewer images.
  const currentImage =
    images[Math.min(selectedImage, Math.max(images.length - 1, 0))]
  return (
    <div className='flex gap-2'>
      <div className='flex flex-col gap-2 mt-8'>
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => {
              setSelectedImage(index)
            }}
            onMouseOver={() => {
              setSelectedImage(index)
            }}
            className={`bg-white rounded-lg overflow-hidden ${
              selectedImage === index
                ? 'ring-2 ring-blue-500'
                : 'ring-1 ring-gray-300'
            }`}
          >
            <Image src={image} alt={'product image'} width={48} height={48} />
          </button>
        ))}
      </div>

      <div className='w-full'>
        <Zoom>
          <div className='relative h-[500px]'>
            {hasImages ? (
              <Image
                src={currentImage}
                alt={'product image'}
                fill
                sizes='90vw'
                className='object-contain'
                priority={selectedImage === 0}
              />
            ) : (
              <div className='flex h-full items-center justify-center rounded-lg bg-muted text-muted-foreground'>
                <ImageOffIcon className='h-16 w-16' aria-hidden />
              </div>
            )}
          </div>
        </Zoom>
      </div>
    </div>
  )
}


