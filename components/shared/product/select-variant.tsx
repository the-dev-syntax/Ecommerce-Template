import { Button } from '@/components/ui/button'
import { IProduct } from '@/lib/db/models/product.model'
import Link from 'next/link'

export default function SelectVariant({
  product,
  size,
  color,
}: {
  product: IProduct
  color: string
  size: string
}) {
  const selectedColor = color || product.colors[0]
  const selectedSize = size || product.sizes[0]

  return (
    <>
      {product.colors.length > 0 && (
        <div className='space-x-2 space-y-2'>
          <div>Color:</div>
          {product.colors.map((x: string) => (
            <Button
              asChild
              variant='outline'
              className={
                selectedColor === x ? 'border-2 border-primary' : 'border-2'
              }
              key={x}
            >
              <Link
                replace
                scroll={false}
                href={`?${new URLSearchParams({
                  color: x,
                  size: selectedSize,
                })}`}
                key={x}
              >
                <div
                  style={{ backgroundColor: x }}
                  className='h-4 w-4 rounded-full border border-muted-foreground'
                ></div>
                {x}
              </Link>
            </Button>
          ))}
        </div>
      )}
      {product.sizes.length > 0 && (
        <div className='mt-2 space-x-2 space-y-2'>
          <div>Size:</div>
          {product.sizes.map((x: string) => (
            <Button
              asChild
              variant='outline'
              className={
                selectedSize === x ? 'border-2  border-primary' : 'border-2  '
              }
              key={x}
            >
              <Link
                replace
                scroll={false}
                href={`?${new URLSearchParams({
                  color: selectedColor,
                  size: x,
                })}`}
              >
                {x}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </>
  )
}

//* asChild Prop
// When asChild is set to true on a component, the component will not render its default root HTML element.
// Instead, it will render the HTML element of its direct child. It then applies its styling and behavior to that child element.
//difference appear in the final HTML rendered in the browser, gives the link the style of the button:
// without asChild <button style="/* Styles from StyledButton */">Click Me</button>
// with asChild <a href="/some-page" style="/* Styles from StyledButton */">Click Me</a>
//? asChild allows you to inject a custom HTML element (like a Link) into a styled component while retaining the component's styling.
//* replace Prop on Next.js Link
// clicking the Link replaces the current history entry instead of adding a new one. This means that the previous page in the history is overwritten.
//* href={`?${new URLSearchParams({
// The backticks ` indicate that you're using a template literal. Template literals are a way to embed expressions inside strings.
// The ? is the standard separator between the base URL and the query parameters in a URL. Everything after the ? is considered part of the query string.
// new URLSearchParams({ color: "blue", size: "M" }) convert object to string like "color=blue&size=M" , and we add ? before it.
