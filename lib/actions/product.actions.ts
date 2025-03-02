'use server'

import { connectToDatabase } from '@/lib/db'
import Product, { IProduct } from '@/lib/db/models/product.model'

//* Finds all published products in the Product collection.
//* Extracts the value of the category field from each of those products.
//* Returns an array containing only the unique category values. Duplicate category values are removed.

export async function getAllCategories() {
  await connectToDatabase()
  const categories = await Product.find({ isPublished: true }).distinct(
    'category'
  )
  return categories
}

//* find takes two arguments , first what to find and second what to return.
//* here find  { tags: { $in: [tag] }, isPublished: true },
//* return name, href, image
//* A value of 1 indicates that you want to include this field in the results. You're explicitly saying you want the name of the product.
//* '$slug': The '$' prefix indicates that slug refers to the value of the slug field in the Product document. It dynamically inserts the product's slug into the URL. This is a common pattern for creating product-specific URLs (e.g., /product/my-cool-product).
//* .sort({ createdAt: 'desc' }) descending order
/*
example of the expected return values
[
  {
    "name": "Product Name",
    "href": "/product/product-slug",
    "image": "url_to_first_image.jpg"
  },
  {
    "name": "Another Product",
    "href": "/product/another-product-slug",
    "image": "url_to_another_image.jpg"
  },
  * ... and so on, up to the limit
]

* another way to do it , maybe a better way :
-------------------------------------------------
export async function getProductsForCard({
  tag,
  limit = 4,
}: {
  tag: string
  limit?: number
}) {
  await connectToDatabase() // Ensure DB connection
  const products = await Product.find(
    { tags: { $in: [tag] }, isPublished: true },
    {
      name: 1,
      href: { $concat: ['/product/', '$slug'] },
      image: { $arrayElemAt: ['$images', 0] },
    }
  )
    .lean() // Add .lean() to get plain JavaScript objects
    .sort({ createdAt: 'desc' })
    .limit(limit);

  return products as {  // No JSON.parse needed now!
    name: string;
    href: string;
    image: string;
  }[];
}
*/

export async function getProductsForCard({
  tag,
  limit = 4,
}: {
  tag: string
  limit?: number
}) {
  await connectToDatabase()
  const products = await Product.find(
    { tags: { $in: [tag] }, isPublished: true },
    {
      name: 1,
      href: { $concat: ['/product/', '$slug'] },
      image: { $arrayElemAt: ['$images', 0] },
    }
  )
    .sort({ createdAt: 'desc' })
    .limit(limit)
  return JSON.parse(JSON.stringify(products)) as {
    name: string
    href: string
    image: string
  }[]
}

// GET PRODUCTS BY TAG
export async function getProductsByTag({
  tag,
  limit = 10,
}: {
  tag: string
  limit?: number
}) {
  await connectToDatabase()
  const products = await Product.find({
    tags: { $in: [tag] },
    isPublished: true,
  })
    .sort({ createdAt: 'desc' })
    .limit(limit)
  return JSON.parse(JSON.stringify(products)) as IProduct[]
}

/*
$in 
$concat
$arrayElemAt
all three are query functions inside mongodb 
1-Connect to the database.

2-Find the two newest products that have the "new-arrival" tag and are published.

3-For each product, extract the name, create an href link using the slug, and get the first image from the images array.

4-Return an array of objects, each containing the name, href, and image for the products found.
*/
