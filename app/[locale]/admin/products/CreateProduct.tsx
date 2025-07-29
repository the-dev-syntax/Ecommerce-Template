 'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProduct } from '@/lib/actions/product.actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { IProductInputForm } from '@/types';
import ProductFormUI from './product-form';
import { ProductInputFormSchema } from '@/lib/validator';


const defaultValues: IProductInputForm = { 
        name: '',
        slug: '',
        category: '',
        images: [],
        brand: '',
        description: '',
        price: 0,
        listPrice: 0,
        countInStock: 0,
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

export const CreateProductForm = () => {
  const router = useRouter()

  const { toast } = useToast()

  const form = useForm<IProductInputForm >({
    resolver: zodResolver(ProductInputFormSchema),
    defaultValues,
  })


  const onSubmit = async (values: IProductInputForm) => {
        const res = await createProduct(values)

        if (!res.success) {
          toast({
            variant: 'destructive',
            description: res.message,
          })
        } else {
          toast({
            description: res.message,
          })
          router.push(`/admin/products`)
        }
      } 
      // ProductFormUI in product-form.tsx
  return <ProductFormUI form={form} onSubmit={onSubmit} isSubmitting={form.formState.isSubmitting} type="Create" />;
};
