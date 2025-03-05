'use client'

import { useState } from 'react'
import Image from 'next/image'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

export default function ProductGallery({ images }: { images: string[] }) {
  const [selectedImage, setSelectedImage] = useState(0)
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
            <Image
              src={images[selectedImage]}
              alt={'product image'}
              fill
              sizes='90vw'
              className='object-contain'
              priority
            />
          </div>
        </Zoom>
      </div>
    </div>
  )
}

/*
* Thumbnail Images:
The images.map() method is used to iterate over the images array and create a thumbnail button for each image.
Each thumbnail button has an onClick and onMouseOver event handler that calls the setSelectedImage function 
with the index of the corresponding image. This updates the selectedImage state, causing the main image to change.

* How it Works in Detail:
-The component receives an array of image URLs as props.
-It displays the first image in the array , index 0
-It maps over the images array to create a series of thumbnail buttons. Each button displays a thumbnail image
and has an event handler that updates the selectedImage state when clicked or hovered.
-The main image is rendered using the Next.js Image component, with the src prop set to the image URL at the index stored in the selectedImage state.
-The Zoom component wraps the main image, enabling zooming functionality.
-When a user clicks or hovers over a thumbnail, the setSelectedImage function is called, updating the selectedImage state.
-This causes the main image to re-render with the new image URL, and the selected thumbnail is highlighted.
*/
