import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
} from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
// useUploadThing is what our custom uploader will use instead of the built-in UploadDropzone.

export const UploadButton = generateUploadButton<OurFileRouter>()
export const UploadDropzone = generateUploadDropzone<OurFileRouter>()
// added
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>()