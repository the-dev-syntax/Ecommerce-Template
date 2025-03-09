This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

## Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

---

---

---

---

---

## [My-notes]

You can move the Primary Side Bar to the right hand side by right-clicking the Activity Bar and selecting Move Primary Side Bar Right or toggle its visibility (Ctrl+B).

changes happened to setting json of vscode

[alt+z] to wrap code lines

change slogans in lib/constants.ts and .env.local
change category array inside search.tsx to array from database
inside header/index.tsx ==> <Button variant='ghost' means the button bg is transparent
made a humburger menu icon (shadcdn) inside a button .
also showed the links in the hearder using map funtion which is a better way to do it.
in header/index.tsx <div className='hidden md:block flex-1 max-w-xl'>
<Search />

</div>
<Menu /> (sign in , cart)
</div>
<div className='md:hidden block py-2'>
<Search />
</div> means, on small screen search will be after menu ==> on big screen search will be before menu

to open new tab in vscode ==> code . ==> it has to have space between.

ctrl c to get out of the running terminal.

---

only limit network access of mongodb to varcel and my laptop.

---

```js
ratingDistribution: z
  .array(
    z.object({
      rating: z.number(),
      count: z.number(),
    })
  )
  .max(5),
```

```js
z.array(...):
```

This defines an array schema. It means ratingDistribution is expected to be an array.

```js
z.object({ ... }):
```

This defines the structure of each object in the array. Each object must have two properties:

rating: A number.

count: A number.

```js
rating: z.number():
```

The rating property must be a number.

```js
count: z.number():
```

The count property must also be a number.

```js
.max(5):
```

This adds a validation rule to the array. It ensures that the array has a maximum length of 5. If the array has more than 5 elements, validation will fail.

## Dealing with teh [database] [mongodb]:

make a project , then make a cluster0 [free], browse collections ==> will show database with all collections under it ==> here you can create databases or the sub databases [which-called-collections].

---

---

## --------------------- changing any keys of the input of a product --------

lib\validator.ts
lib/data.ts
lib\db\models\product.model.ts

## npm run seed

commented colors key to the three files
added form key to all three files
changes the value of brands to EV in the data.ts file

// beauty
{
name: 'EV Hair skin and nails with vitamins and Biotin 5000mcg',
slug: toSlug('EV Hair skin and nails with vitamins and Biotin 5000mcg'),
category: 'Hair Supplements',
images: ['/images/bioten-1.jpg', '/images/bioten-2.jpg'],
tags: ['new-arrival'],
isPublished: true,
price: 24.8,
listPrice: 0,
form: 'Capsule',
brand: 'EV',
avgRating: 4.71,
numReviews: 7,
ratingDistribution: [
{ rating: 1, count: 0 },
{ rating: 2, count: 0 },
{ rating: 3, count: 0 },
{ rating: 4, count: 2 },
{ rating: 5, count: 5 },
],
numSales: 9,
countInStock: 11,
description:
'Help to stimulate faster hair growth while combating dryness, enhancing elasticity and fortifying hair follicles. By preventing breakage this formula ensures your strands stay strong, hydrated, and resilient for healthier, long lasting growth.',
sizes: ['60', '120', '360'],
colors: ['Green', 'Red', 'Black'],

    reviews: [],

},

## --------------------- explaining product-price.tsx --------

```tsx
import { cn, formatCurrency } from '@/lib/utils' // Imports utility functions: 'cn' for conditional class names and 'formatCurrency' for formatting currency.

const ProductPrice = ({
  // Defines a React functional component named 'ProductPrice' that takes props.
  price, // Required prop: The current price of the product (number).
  className, // Optional prop: Custom CSS class names to apply to the price display (string).
  listPrice = 0, // Optional prop: The original list price of the product (number, defaults to 0).
  isDeal = false, // Optional prop:  Indicates if the product is on a special deal (boolean, defaults to false).
  forListing = true, // Optional prop: Indicates if the component is being used in a listing context (boolean, defaults to true).
  plain = false, // Optional prop:  If true, just display the formatted price, no extra styling (boolean, defaults to false).
}: {
  // Defines the type of each of the props. Typescript syntax.
  price: number
  isDeal?: boolean
  listPrice?: number
  className?: string
  forListing?: boolean
  plain?: boolean
}) => {
  const discountPercent = Math.round(100 - (price / listPrice) * 100) // Calculates the discount percentage, rounding to the nearest whole number.

  const stringValue = price.toString() // Converts the price number to a string.
  const [intValue, floatValue] = stringValue.includes('.') // Splits the price string into integer and fractional parts (if any).
    ? stringValue.split('.') // If there's a decimal point, split the string at the decimal point.
    : [stringValue, ''] // Otherwise, the entire string is the integer part, and the fractional part is an empty string.

  return plain ? ( // If the 'plain' prop is true...
    formatCurrency(price) // ...simply format the price as currency and return it.  No extra styling.
  ) : listPrice == 0 ? ( // Otherwise, if the list price is 0 (meaning no discount)...
    <div className={cn('text-3xl', className)}>
      {' '}
      {/*Renders the price with a large font size and any custom class names.*/}
      <span className='text-xs align-super'>$</span>{' '}
      {/*Renders the dollar sign as a superscript.*/}
      {intValue} {/*Renders the integer part of the price.*/}
      <span className='text-xs align-super'>{floatValue}</span>{' '}
      {/*Renders the fractional part of the price as a superscript.*/}
    </div>
  ) : isDeal ? ( // Otherwise, if it's a deal...
    <div className='space-y-2'>
      {' '}
      {/*Wraps the deal-specific content with vertical spacing.*/}
      <div className='flex justify-center items-center gap-2'>
        {' '}
        {/*Renders the discount badge and "Limited time deal" text.*/}
        <span className='bg-red-700 rounded-sm p-1 text-white text-sm font-semibold'>
          {' '}
          {/*Styled discount badge.*/}
          {discountPercent}% Off{' '}
          {/*Displays the calculated discount percentage.*/}
        </span>
        <span className='text-red-700 text-xs font-bold'>
          {' '}
          {/*"Limited time deal" text.*/}
          Limited time deal
        </span>
      </div>
      <div
        className={`flex ${forListing && 'justify-center'} items-center gap-2`}
      >
        {' '}
        {/*Renders the current price and original price.*/}
        <div className={cn('text-3xl', className)}>
          {' '}
          {/*Current price with custom styling.*/}
          <span className='text-xs align-super'>$</span>{' '}
          {/*Dollar sign as a superscript.*/}
          {intValue} {/*Integer part of the price.*/}
          <span className='text-xs align-super'>{floatValue}</span>{' '}
          {/*Fractional part as a superscript.*/}
        </div>
        <div className='text-muted-foreground text-xs py-2'>
          {' '}
          {/*Original price with a strikethrough.*/}
          Was: <span className='line-through'>
            {formatCurrency(listPrice)}
          </span>{' '}
          {/*Formatted list price with a strikethrough.*/}
        </div>
      </div>
    </div>
  ) : (
    // Otherwise (if there's a list price and it's not a special deal)...
    <div className=''>
      {' '}
      {/*Wraps the default discount display.*/}
      <div className='flex justify-center gap-3'>
        {' '}
        {/*Renders the discount percentage and current price.*/}
        <div className='text-3xl text-orange-700'>-{discountPercent}%</div>{' '}
        {/*Discount percentage in orange.*/}
        <div className={cn('text-3xl', className)}>
          {' '}
          {/*Current price with custom styling.*/}
          <span className='text-xs align-super'>$</span>{' '}
          {/*Dollar sign as a superscript.*/}
          {intValue} {/*Integer part of the price.*/}
          <span className='text-xs align-super'>{floatValue}</span>{' '}
          {/*Fractional part as a superscript.*/}
        </div>
      </div>
      <div className='text-muted-foreground text-xs py-2'>
        {' '}
        {/*Renders the list price with a strikethrough.*/}
        List price:{' '}
        <span className='line-through'>{formatCurrency(listPrice)}</span>{' '}
        {/*Formatted list price with a strikethrough.*/}
      </div>
    </div>
  )
}

export default ProductPrice // Exports the ProductPrice component for use elsewhere.
```

## --------------------- explaining [product] folder ------------------------------------------------------

The `product` folder contains lower logic files
1- product-price.tsx which diplays the price on deals or just the price and formating it using utils file.
2- rating.tsx which floor() and ceil() the rating and the partial star, to display the rating as stars.
3- image-hover.tsx which displays the image on hover, (usestate and timeout).

then the product-card.tsx which displays the product image and details in card like display.

then the product.silder.tsx which displays(maps) the product-card as a carousel.

then displayed on the home page inside a card component again.(passing a filtered products array by tag "todaysdeal" specifically)
making it a todays deal slider section.

## ------------------------------------------------------------------------------------------------------------

[theme] customization
workbench.colorCustomizations search in setting and open json file.
added all what is inside "workbench.colorCustomizations": {..here..}

```json
"workbench.colorCustomizations": {

    "[GitHub Dark High Contrast]": {
      "editor.background": "#000000",
      "contrastBorder": "#383838",
      "tab.activeBorderTop": "#383838",
      "menu.border": "#383838",
      "sideBar.border": "#383838",
      "tab.border": "#383838",
      "menubar.selectionBorder": "#125f0a",
      "menu.separatorBackground": "#383838",
      "activityBar.border": "#383838",
      "titleBar.border": "#383838",
      "editorGroup.border": "#383838",
      "editorGroupHeader.tabsBorder": "#383838",
      "tab.activeBorder": "#383838",
      "contrastActiveBorder": "#00000000",
      "tab.activeBackground": "#08841f",
      "tab.activeForeground": "#ffffff"
    }
  },

```

## --------------------------------------------------------------------------------------------------

export const PAGE_SIZE = Number(process.env.PAGE_SIZE || 9)
to show nine items per page for pagination.

## --------------------------------------Gemini advice------------------------------------------------------------

## file browsing-history/route.ts

Error Handling: The code lacks robust error handling. Consider adding try...catch blocks around the database connection and query to handle potential errors (e.g., database connection errors, invalid queries).

Input Validation and Sanitization: The code performs minimal validation. It should perform more thorough validation and sanitization of the input parameters (productIds, categories) to prevent potential security vulnerabilities (e.g., SQL injection) and unexpected behavior. For example, ensure that the IDs are valid object IDs and that categories are valid category strings.

Database Connection Management: The connectToDatabase() function likely handles connection pooling. Ensure that the connection is properly closed after the request is processed (or that the connection pool is managed effectively) to avoid resource leaks.

Performance: For large browsing histories (many productIds and categories), the $in operator in MongoDB can become slow. Consider optimizing the database schema or using alternative query strategies if performance becomes an issue. Indexing the category and \_id fields in the Product collection is important.

Type Safety: Using TypeScript, add types to the productIds and categories variables.

Security: Sanitize the parameters to prevent NoSQL injection attacks.

## Logging: Add logging to help debug issues.

example for handling errors :

```tsx
export const GET = async (request: NextRequest) => {
  try {
    const listType = request.nextUrl.searchParams.get('type') || 'history'
    const productIdsParam = request.nextUrl.searchParams.get('ids')
    const categoriesParam = request.nextUrl.searchParams.get('categories')

    if (!productIdsParam || !categoriesParam) {
      return NextResponse.json([])
    }

    const productIds = productIdsParam.split(',')
    const categories = categoriesParam.split(',')
    // TODO:  Sanitize productIds and categories here!  Prevent NoSQL injection.

    const filter =
      listType === 'history'
        ? {
            _id: { $in: productIds },
          }
        : { category: { $in: categories }, _id: { $nin: productIds } }

    await connectToDatabase()
    const products = await Product.find(filter)

    if (listType === 'history') {
      return NextResponse.json(
        products.sort(
          (a, b) =>
            productIds.indexOf(a._id.toString()) -
            productIds.indexOf(b._id.toString())
        )
      )
    } else {
      return NextResponse.json(products)
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    return new NextResponse('Internal Server Error', { status: 500 }) // Send an error response
  }
}
```

---

example for handling NoSQL injection :data injection:

```tsx
import { isValidObjectId } from 'mongoose' // Import to validate ObjectIds
import { NextResponse } from 'next/server'

const allowedCategories = ['electronics', 'clothing', 'books', 'home'] // Example

export const GET = async (request: NextRequest) => {
  try {
    const listType = request.nextUrl.searchParams.get('type') || 'history'
    const productIdsParam = request.nextUrl.searchParams.get('ids')
    const categoriesParam = request.nextUrl.searchParams.get('categories')

    if (!productIdsParam || !categoriesParam) {
      return NextResponse.json([])
    }

    const productIds = productIdsParam.split(',')
    const categories = categoriesParam.split(',')

    // Sanitize and Validate productIds
    const validProductIds = productIds.filter((id) => {
      if (!isValidObjectId(id)) {
        console.warn(`Invalid Product ID: ${id}`)
        return false // Filter out invalid IDs
      }
      return true
    })

    if (validProductIds.length !== productIds.length) {
      return new NextResponse('Invalid product IDs provided.', { status: 400 }) //Reject request if any IDs are invalid
    }

    // Sanitize and Validate Categories
    const validCategories = categories.filter((category) => {
      if (!allowedCategories.includes(category)) {
        console.warn(`Invalid Category: ${category}`)
        return false // Filter out invalid categories
      }
      return true
    })

    if (validCategories.length !== categories.length) {
      return new NextResponse('Invalid categories provided.', { status: 400 }) //Reject request if any IDs are invalid
    }

    // ... rest of your code using validProductIds and validCategories ...

    const filter =
      listType === 'history'
        ? {
            _id: { $in: validProductIds },
          }
        : { category: { $in: validCategories }, _id: { $nin: validProductIds } }

    // ... database query and response ...
  } catch (error) {
    console.error('Error fetching products:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
```

---

## recommended changes in browsing-history-list.tsx

```tsx
function ProductList(...) { // Same as before, but add loading state
  const { products } = useBrowsingHistory()
  const [data, setData] = React.useState([])
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null); // Clear any previous errors
      try {
        const res = await fetch(
          `/api/products/browsing-history?type=${type}&categories=${products
            .map((product) => product.category)
            .join(',')}&ids=${products.map((product) => product.id).join(',')}`
        );

        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`); // Handle non-200 responses
        }

        const data = await res.json();
        setData(data);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError(err); // Store the error
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [products, type]);

  if (loading) {
    return <div>Loading products...</div>; // Simple loading indicator
  }

  if (error) {
    return <div>Error: {error.message}</div>; // Display the error message
  }

  return (
    data.length > 0 && (
      <ProductSlider title={title} products={data} hideDetails={hideDetails} />
    )
  );
}
```

---

##
