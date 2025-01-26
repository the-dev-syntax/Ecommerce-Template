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

## My notes

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
</div> means on small screen search will be after menu ==> on big screen search will be before menu
code . ==> it has to have space between.
ctrl c tto get out of the running terminal.
