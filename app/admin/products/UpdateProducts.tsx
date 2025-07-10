 'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProduct } from '@/lib/actions/product.actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { IProductInputForm } from '@/types';
import ProductFormUI from './product-form';
import { ProductInputFormSchema } from '@/lib/validator';
import { IProduct } from '@/lib/db/models/product.model';
import { useEffect } from 'react';


const defaultValues: IProductInputForm = { 
    name: 'Sample Product',
    slug: 'sample-product',
    category: 'Sample Category',
    images: ['/images/p11-1.jpg'],
    brand: 'Sample Brand',
    description: 'This is a sample description of the product.',
    price: 99.99,
    listPrice: 0,
    countInStock: 15,
    numReviews: 0,
    avgRating: 0,
    numSales: 0,
    isPublished: false,
    tags: [],
    sizes: [],
    colors: [],
    ratingDistribution: [],
    reviews: [],
 };

export const UpdateProductForm = ({    
    product,
    productId,
  }: {   
    product: IProduct
    productId: string
  }) => {
    const router = useRouter()
    const { toast } = useToast()

    const form = useForm<IProductInputForm>({
      resolver: zodResolver(ProductInputFormSchema),
      defaultValues: product || defaultValues,
  })


    useEffect(() => {
        if (product) {
        form.reset(product);
        }
    }, [product, form.reset]);

  const onSubmit = async (values: IProductInputForm) => {

        if (!productId) {
            router.push(`/admin/products`)
            return
          }

          const res = await updateProduct({ ...values, _id: productId })
          if (!res.success) {
            toast({
              variant: 'destructive',
              description: res.message,
            })
          } else {
            router.push(`/admin/products`)
          }
        }
      
     
  

  return <ProductFormUI form={form} onSubmit={onSubmit} isSubmitting={form.formState.isSubmitting} type="Update" />;
};
