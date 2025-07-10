// import Link from 'next/link'

// import { Metadata } from 'next'
// import { CreateProductForm } from '../CreateProduct'
// // import ProductFormUI from '../product-form'

// export const metadata: Metadata = {
//   title: 'Create Product',
// }

// const CreateProductPage = () => {
//   return (
//     <main className='max-w-6xl mx-auto p-4'>
//       <div className='flex mb-4'>
//         <Link href='/admin/products'>Products</Link>
//         <span className='mx-1'>›</span>
//         <Link href='/admin/products/create'>Create</Link>
//       </div>

//       <div className='my-8'>
//         <CreateProductForm  />
//       </div>
//     </main>
//   )
// }

// export default CreateProductPage

import Link from 'next/link'
import { Metadata } from 'next'
import { CreateProductForm } from '../CreateProduct'

export const metadata: Metadata = {
  title: 'Create Product',
}

const CreateProductPage = () => {
  return (
    <main className='max-w-6xl mx-auto p-4'>
      <div className='flex mb-4'>
        <Link href='/admin/products'>Products</Link>
        <span className='mx-1'>›</span>
        <Link href='/admin/products/create'>Create</Link>
      </div>

      <div className='my-8'>
        <CreateProductForm />
      </div>
    </main>
  )
}

export default CreateProductPage