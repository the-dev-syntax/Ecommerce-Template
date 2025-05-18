import { NextRequest, NextResponse } from 'next/server'

import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'

export const GET = async (request: NextRequest) => {
  const listType = request.nextUrl.searchParams.get('type') || 'history'
  const productIdsParam = request.nextUrl.searchParams.get('ids')
  const categoriesParam = request.nextUrl.searchParams.get('categories')

  if (!productIdsParam || !categoriesParam) {
    return NextResponse.json([])
  }

  // convert the string of ids and categories to an array.
  const productIds = productIdsParam.split(',')
  const categories = categoriesParam.split(',')

  // filter is the parameter of the find function query for the database after connecting to the db.
  const filter =
    listType === 'history'
      ? {
          _id: { $in: productIds },
        }
      : { category: { $in: categories }, _id: { $nin: productIds } }

  await connectToDatabase()

  const products = await Product.find(filter)

  if (listType === 'history')
    return NextResponse.json(
      products.sort(
        (a, b) =>
          productIds.indexOf(a._id.toString()) -
          productIds.indexOf(b._id.toString())
      )
    )
  return NextResponse.json(products)
}

//? : { category: { $in: categories }, _id: { $nin: productIds } }
// get categories like product categories in the req, and find in these categories products that are not products in the req.

//? Sorting for History:
//  If listType is 'history', the code sorts the retrieved products based on their order in the original productIds array.
//  This ensures that the browsing history is displayed in the order in which the user viewed the products.
//  This is done using products.sort((a, b) => productIds.indexOf(a._id.toString()) - productIds.indexOf(b._id.toString())).
//  The sort function gets the index of the product IDs from the original productIds array and sorts based on that.
//  It's important to convert the _id (which is likely a MongoDB ObjectId) to a string using toString() before comparing.
