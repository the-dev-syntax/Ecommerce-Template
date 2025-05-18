'use server'

import { connectToDatabase } from '@/lib/db'
import Product, { IProduct } from '@/lib/db/models/product.model'
import { PAGE_SIZE } from '../constants'

//* GET ALL CATEGORIES
export async function getAllCategories() {
  await connectToDatabase()
  const categories = await Product.find({ isPublished: true }).distinct(
    'category'
  )
  return categories
}

//* GET PRODUCTS FOR CARD
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

//* GET PRODUCTS BY TAG
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

// GET ONE PRODUCT BY SLUG
export async function getProductBySlug(slug: string) {
  await connectToDatabase()
  const product = await Product.findOne({ slug, isPublished: true })
  if (!product) throw new Error('Product not found')
  return JSON.parse(JSON.stringify(product)) as IProduct
}

//* GET RELATED PRODUCTS: PRODUCTS WITH SAME CATEGORY
export async function getRelatedProductsByCategory({
  category,
  productId,
  limit = PAGE_SIZE, //how many products per page
  page = 1, //current page number
}: {
  category: string
  productId: string
  limit?: number
  page: number
}) {
  await connectToDatabase()
  const skipAmount = (Number(page) - 1) * limit // explaination down
  const conditions = {
    isPublished: true,
    category,
    _id: { $ne: productId }, //exclude the current product
  }
  const products = await Product.find(conditions)
    .sort({ numSales: 'desc' })
    .skip(skipAmount)
    .limit(limit)
  const productsCount = await Product.countDocuments(conditions)
  return {
    data: JSON.parse(JSON.stringify(products)) as IProduct[],
    totalPages: Math.ceil(productsCount / limit),
  }
}

//* GET ALL CATEGORIES
// Finds all published products in the Product collection.
// Extracts the value of the category field from each of those products.
// Returns an array containing only the unique category values. Duplicate category values are removed.

//* getProductsForCard
// find takes two arguments , first what to find and second what to return.
// here find  { tags: { $in: [tag] }, isPublished: true },
// return name, href, image
// A value of 1 indicates that you want to include this field in the results. You're explicitly saying you want the name of the product.
// '$slug': The '$' prefix indicates that slug refers to the value of the slug field in the Product document. It dynamically inserts the product's slug into the URL. This is a common pattern for creating product-specific URLs (e.g., /product/my-cool-product).
// .sort({ createdAt: 'desc' }) descending order

//* getProductBySlug
// Connects to the database, retrieves a published product by slug, throws an error if not found,
// and returns a plain JavaScript object representing the product, typed as IProduct.

//* getRelatedProductsByCategory
// Connects to the database, retrieves related and published products based on category (excluding the given product),
// sorts them by sales -descending order, paginates the results, retrieves the total count of matching products,
// and returns an object containing the paginated product data and the total number of pages.
// limit is the limit of products to display in one page. limit = means page size.
// page = means current page , are you in page 1, page 2, page 3 and so on
// const skipAmount = (Number(page) - 1) * limit  // how many products to skip to get to the current page (skip 9 from page 1 and 9 from page 2 and display from 19 to 28)
/* const products = await Product.find(conditions)
    .sort({ numSales: 'desc' })
    .skip(skipAmount)
    .limit(limit)
    find my products by category and exclude the current product, sort them by sales in descending order, skip the product displayed in previous pages (if it was the first page the skipAmount will be zero) ,limit them by the limit value per page like(9 products per page ).
*/
//  const productsCount = await Product.countDocuments(conditions) ==> this is a mongodb method to count the number of documents that match the conditions.

// expected return of the function is an object like that:
/*
{
  "data": [
    {
      "_id": "64f...",
      "name": "Related Product 1",
      "category": "Electronics",
      "price": 99.99,
      "isPublished": true,
      ? ... other product properties
    },
    {
      "_id": "650...",
      "name": "Related Product 2",
      "category": "Electronics",
      "price": 149.99,
      "isPublished": true,
      ? ... other product properties
    }
  ],
  "totalPages": 5
}
*/
//---------------------------------notes---------------------------------
/*

$in          ==> finds all documents where the value of a field is one of the specified values
$concat      ==> creates a new string by concatenating the values of two or more fields
$arrayElemAt ==> returns the element at the specified index from an array field
$ne          ==> exclude the current product
all three are query functions inside mongodb 

* //* GET PRODUCTS FOR CARD
1-Connect to the database.
2-Find the two newest products that have the "new-arrival" tag and are published.
3-For each product, extract the name, create an href link using the slug, and get the first image from the images array.
4-Return an array of objects, each containing the name, href, and image for the products found.

*/

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
