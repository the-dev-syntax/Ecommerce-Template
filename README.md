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

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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

commented colors key to the three files
added form key to all three files
changes the value of brands to EV in the data.ts file

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
