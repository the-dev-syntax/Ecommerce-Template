import { Data, IProductInput, IUserInput, IWebPageInput, ISettingInput } from '@/types'
import { slugify } from './utils'
import { i18n } from '@/i18n-config'

// Pre-hashed passwords to avoid bcrypt.hashSync() at module load time
// This prevents timeout issues on Vercel serverless functions
// Generated with: bcrypt.hashSync('password', 12)
const HASHED_PASSWORDS = {
  admin: '$2a$12$QHGCkYhj8Np.QvKrJlU7T.8r1H4.RHvVYpzN6gG9zJ8kDdVtZmZEe', // totalena#1And4
  user1: '$2a$12$K5.qJL7YNu9RG5r3nEL5UOoD9qZB1qYpNNtVYr5xVJH0.q8R3OdKa', // 12345678
  user: '$2a$12$wQfPEw.AkCNV9J5vS.4XRONc8qZqD.TqFJH8UxNYvKqXjL8.Nq.3W', // 123456
}

const users: IUserInput[] = [
  {
    name: 'deca',
    email: 'the.dev.syntax@gmail.com',

    password: HASHED_PASSWORDS.admin,
    role: 'admin',
    address: {
      fullName: 'John Doe',
      street: '111 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10001',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Stripe',
    emailVerified: new Date("2025-07-30T00:00:00.000Z"),
    verificationToken: null,
    verificationTokenExpires: null,
  },
  {
    name: 'Jane',
    email: 'jane@example.com',

    password: HASHED_PASSWORDS.user1,

    role: 'user',
    address: {
      fullName: 'Jane Harris',
      street: '222 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '1002',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: null,
  },
  {
    name: 'Jack',
    email: 'jack@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Jack Ryan',
      street: '333 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '1003',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'PayPal',
    emailVerified: null,
  },
  {
    name: 'Sarah',
    email: 'sarah@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Sarah Smith',
      street: '444 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '1005',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: null,
  },
  {
    name: 'Michael',
    email: 'michael@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'John Alexander',
      street: '555 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '1006',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'PayPal',
    emailVerified: null,
  },
  {
    name: 'Emily',
    email: 'emily@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Emily Johnson',
      street: '666 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10001',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Stripe',
    emailVerified: null,
  },
  {
    name: 'Alice',
    email: 'alice@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Alice Cooper',
      street: '777 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10007',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: null,
  },
  {
    name: 'Tom',
    email: 'tom@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Tom Hanks',
      street: '888 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10008',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Stripe',
    emailVerified: null,
  },
  {
    name: 'Linda',
    email: 'linda@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Linda Holmes',
      street: '999 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10009',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'PayPal',
    emailVerified: null,
  },
  {
    name: 'George',
    email: 'george@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'George Smith',
      street: '101 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10010',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Stripe',
    emailVerified: null,
  },
  {
    name: 'Jessica',
    email: 'jessica@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Jessica Brown',
      street: '102 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10011',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: null,
  },
  {
    name: 'Chris',
    email: 'chris@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Chris Evans',
      street: '103 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10012',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'PayPal',
    emailVerified: null,
  },
  {
    name: 'Samantha',
    email: 'samantha@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Samantha Wilson',
      street: '104 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10013',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Stripe',
    emailVerified: null,
  },
  {
    name: 'David',
    email: 'david@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'David Lee',
      street: '105 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10014',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: null,
  },
  {
    name: 'Anna',
    email: 'anna@example.com',

    password: HASHED_PASSWORDS.user,

    role: 'user',
    address: {
      fullName: 'Anna Smith',
      street: '106 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10015',
      country: 'USA',
      phone: '123-456-7890',
    },
    paymentMethod: 'PayPal',
    emailVerified: null,
  },
]


const products: IProductInput[] = [
  // T-Shirt
  {
    name: 'Nike Mens Slim-fit Long-Sleeve T-Shirt',
    slug: slugify('Nike Mens Slim-fit Long-Sleeve T-Shirt'),
    category: 'T-Shirts',
    images: ['/images/p11-1.jpg', '/images/p11-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 21.8,
    listPrice: 0,
    brand: 'Nike',
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
      'Made with chemicals safer for human health and the environment',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Green', 'Red', 'Black'],

    reviews: [],
  },
  {
    name: 'Jerzees Long-Sleeve Heavyweight Blend T-Shirt',
    slug: slugify('Jerzees Long-Sleeve Heavyweight Blend T-Shirt'),
    category: 'T-Shirts',
    images: [
      '/images/p12-1.jpg',
      '/images/p12-2.jpg',
      '/images/p12-3.jpg',
      '/images/p12-4.jpg',
    ],
    tags: ['featured'],
    isPublished: true,
    price: 23.78,
    listPrice: 0,
    brand: 'EV',
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 29,
    countInStock: 12,
    description:
      'Made with sustainably sourced USA grown cotton; Shoulder-to-shoulder tape; double-needle coverstitched front neck; Set-in sleeves; Rib cuffs with concealed seams; Seamless body for a wide printing area',

    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Yellow', 'Red', 'Black'],

    reviews: [],
  },
  {
    name: "Jerzees Men's Long-Sleeve T-Shirt",
    slug: slugify('Jerzees Men Long-Sleeve T-Shirt'),
    category: 'T-Shirts',
    brand: 'EV',
    images: ['/images/p13-1.jpg', '/images/p13-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 13.86,
    listPrice: 16.03,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 55,
    countInStock: 13,
    description:
      'The Jerzees long sleeve t-shirt is made with dri-power technology that wicks away moisture to keep you cool and dry throughout your day. We also included a rib collar and cuffs for added durability, and a lay-flat collar for comfort. If you are looking for a versatile shirt that you can wear throughout the transitioning seasons, then look no further.',
    sizes: ['XL', 'XXL'],
    colors: ['Green', 'White'],

    reviews: [],
  },
  {
    name: 'Decrum Mens Plain Long Sleeve T-Shirt - Comfortable Soft Fashion V Neck Full Sleeves Jersey Shirts',
    slug: slugify(
      'Decrum Mens Plain Long Sleeve T-Shirt - Comfortable Soft Fashion V Neck Full Sleeves Jersey Shirts'
    ),
    category: 'T-Shirts',
    brand: 'EV',
    images: ['/images/p14-1.jpg', '/images/p14-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 26.95,
    listPrice: 46.03,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 54,
    countInStock: 14,
    description:
      'Elevate your outfit with this soft long sleeve t shirt men. This full sleeves tee is the ultimate upgrade from your regular cotton t-shirt. ',
    sizes: ['XL', 'XXL'],
    colors: ['Yellow', 'White'],

    reviews: [],
  },
  {
    name: "Muscle Cmdr Men's Slim Fit Henley Shirt Long&Short Business Sleeve Casual 3 Metal Buton Placket Casual Stylish T-Shirt",
    slug: slugify(
      "Muscle Cmdr Men's Slim Fit Henley Shirt Long&Short Business Sleeve Casual 3 Metal Buton Placket Casual Stylish T-Shirt"
    ),
    category: 'T-Shirts',
    brand: 'EV Cmdr',
    images: ['/images/p15-1.jpg', '/images/p15-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 29.99,
    listPrice: 35.99,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 54,
    countInStock: 15,
    description:
      "Slim Fit Design:Men's Muscle Slim Fit Button Henley Shirts are designed to fit snugly against your body, accentuating your muscles and creating a sleek silhouette that's perfect for any occasion. ",
    sizes: ['XL', 'XXL'],
    colors: ['Green', 'Yellow'],

    reviews: [],
  },
  {
    name: 'Hanes Mens Long Sleeve Beefy Henley Shirt',
    slug: slugify('Hanes Mens Long Sleeve Beefy Henley Shirt'),
    category: 'T-Shirts',
    brand: 'EV',
    images: ['/images/p16-1.jpg', '/images/p16-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 25.3,
    listPrice: 32.99,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 16,
    numSales: 56,
    description:
      'Heavyweight cotton (Heathers are 60% cotton/40% polyester; Pebblestone is 75% cotton/25% polyester)',
    sizes: ['XL', 'XXL'],
    colors: ['Grey', 'White'],

    reviews: [],
  },
  // Jeans
  {
    name: 'Silver Jeans Co. Mens Jace Slim Fit Bootcut Jeans',
    slug: slugify('Silver Jeans Co. Mens Jace Slim Fit Bootcut Jeans'),
    category: 'Jeans',
    brand: 'EV Jeans Co',
    images: ['/images/p21-1.jpg', '/images/p21-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 95.34,
    listPrice: 0,
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    countInStock: 54,
    numSales: 21,
    description:
      'Silver Jeans Co. Jace Slim Fit Bootcut Jeans - Consider Jace a modern cowboy jean. It sits below the waist and features a slim fit through the hip and thigh. Finished with an 18” bootcut leg opening that complements the slimmer silhouette while still fitting over boots',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: ['Blue', 'Grey'],

    reviews: [],
  },
  {
    name: "Levi's mens 505 Regular Fit Jeans (Also Available in Big & Tall)",
    slug: slugify(
      "Levi's mens 505 Regular Fit Jeans (Also Available in Big & Tall)"
    ),
    category: 'Jeans',
    brand: "EV's",
    images: ['/images/p22-1.jpg', '/images/p22-2.jpg'],
    tags: ['featured'],
    isPublished: true,
    price: 59.99,
    listPrice: 69.99,
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 22,
    numSales: 54,
    description:
      'A veritable classic, this 505 is made to have a comfortable look and style.',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: ['Blue', 'Grey'],

    reviews: [],
  },
  {
    name: 'Essentials Mens Straight-Fit Stretch Jean',
    slug: slugify('Essentials Mens Straight-Fit Stretch Jean'),
    category: 'Jeans',
    brand: 'EV',
    images: ['/images/p23-1.jpg', '/images/p23-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 38.9,
    listPrice: 45,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 23,
    numSales: 54,
    description:
      'These classic 5-pocket straight-fit jeans are crafted with a bit of stretch for additional comfort and to help maintain their shape',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: ['Grey', 'Blue'],

    reviews: [],
  },
  {
    name: "Buffalo David Bitton Mens Men's Driven Relaxed Denim JeansJeans",
    slug: slugify(
      "Buffalo David Bitton Mens Men's Driven Relaxed Denim JeansJeans"
    ),
    category: 'Jeans',
    brand: 'EV David Bitton',
    images: ['/images/p24-1.jpg', '/images/p24-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 69.99,
    listPrice: 100,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 24,
    numSales: 53,
    description:
      'Stretch recycled denim jeans in an authentic and sanded wash blue. Features a comfortable low-rise waist with a relaxed fit at the leg. The distressed look gives these jeans an effortlessly worn-in feel. The eco-friendly logo patch in tan and red is at the back waistband. The signature maple leaf graphic is debossed at the zip-fly.',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: ['Blue', 'Grey'],

    reviews: [],
  },
  {
    name: 'Dickies Mens Relaxed Fit Carpenter Jean',
    slug: slugify('Dickies Mens Relaxed Fit Carpenter Jean'),
    category: 'Jeans',
    brand: 'EV',
    images: ['/images/p25-1.jpg', '/images/p25-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 95.34,
    listPrice: 0,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 25,
    numSales: 48,
    description:
      'Relaxed work jean with traditional carpenter-style pockets and logo patch at back pockets',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: ['Blue', 'Grey'],

    reviews: [],
  },
  {
    name: 'Wrangler mens Premium Performance Cowboy Cut Slim Fit Jean',
    slug: slugify('Wrangler mens Premium Performance Cowboy Cut Slim Fit Jean'),
    category: 'Jeans',
    brand: 'EV',
    images: ['/images/p26-1.jpg', '/images/p26-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 81.78,
    listPrice: 149.99,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 26,
    numSales: 48,
    description:
      'Designed with a functional fit in mind, these jeans are made to stack over your favorite pair of boots. Constructed with a slim fit in the waist, seat, and thigh, this jean is made for both function and comfort for long days in the saddle.',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: ['Blue', 'Grey'],

    reviews: [],
  },
  // Watches
  {
    name: "Seiko Men's Analogue Watch with Black Dial",
    slug: slugify("Seiko Men's Analogue Watch with Black Dial"),
    category: 'Wrist Watches',
    brand: 'EV',
    images: ['/images/p31-1.jpg', '/images/p31-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 530.0,
    listPrice: 0,
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    countInStock: 31,
    numSales: 48,
    description:
      'Casing: Case made of stainless steel Case shape: round Case colour: silver Glass: Hardlex Clasp type: Fold over clasp with safety',
    sizes: [],
    colors: [],

    reviews: [],
  },
  {
    name: 'SEIKO 5 Sport SRPJ83 Beige Dial Nylon Automatic Watch, Beige, Automatic Watch',
    slug: slugify(
      'SEIKO 5 Sport SRPJ83 Beige Dial Nylon Automatic Watch, Beige, Automatic Watch'
    ),
    category: 'Wrist Watches',
    brand: 'EV',
    images: ['/images/p32-1.jpg', '/images/p32-2.jpg'],
    tags: ['featured'],
    isPublished: true,
    price: 375.83,
    listPrice: 400,
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 32,
    numSales: 48,
    description:
      'Seiko 5 Sports Collection Inspired by vintage field/aviator style: Automatic with manual winding capability',
    sizes: [],
    colors: [],

    reviews: [],
  },
  {
    name: "Casio Men's Heavy Duty Analog Quartz Stainless Steel Strap, Silver, 42 Casual Watch ",
    slug: slugify(
      "Casio Men's Heavy Duty Analog Quartz Stainless Steel Strap, Silver, 42 Casual Watch"
    ),
    category: 'Wrist Watches',
    brand: 'EV',
    images: ['/images/p33-1.jpg', '/images/p33-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 60.78,
    listPrice: 0,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 33,
    numSales: 48,
    description:
      'The Casio range is growing with this model  MWA-100H-1AVEF. Sporting a stainless steel case with a brushed finish, it will easily withstand all the shocks of everyday life.',
    sizes: [],
    colors: [],

    reviews: [],
  },
  {
    name: 'Casio Classic Silver-Tone Stainless Steel Band Date Indicator Watch',
    slug: slugify(
      'Casio Classic Silver-Tone Stainless Steel Band Date Indicator Watch'
    ),
    category: 'Wrist Watches',
    brand: 'EV',
    images: ['/images/p34-1.jpg', '/images/p34-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 34.22,
    listPrice: 54.99,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 34,
    numSales: 48,
    description:
      'The new MTPVD01D-7EV is a classic 50 meter water resistant stainless steel watch now updated with a white dial. This elegant 3 hand, date display timepiece is perfect for any setting.',
    sizes: [],
    colors: [],

    reviews: [],
  },
  {
    name: "Fossil Men's Grant Stainless Steel Quartz Chronograph Watch",
    slug: slugify("Fossil Men's Grant Stainless Steel Quartz Chronograph Watch"),
    category: 'Wrist Watches',
    brand: 'EV',
    images: ['/images/p35-1.jpg', '/images/p35-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 171.22,
    listPrice: 225,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 35,
    numSales: 48,
    description:
      'Chronograph watch featuring silver- and blue-tone case, blue sunray dial, and silver-tone Roman numeral indices',
    sizes: [],
    colors: ['Blue', 'Black', 'Sliver'],

    reviews: [],
  },
  {
    name: "Fossil Men's Machine Stainless Steel Quartz Watch",
    slug: slugify("Fossil Men's Machine Stainless Steel Quartz Watch"),
    category: 'Wrist Watches',
    brand: 'EV',
    images: ['/images/p36-1.jpg', '/images/p36-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 158.21,
    listPrice: 229.0,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 36,
    numSales: 49,
    description:
      'In masculine black-on-black, our industrial-inspired Machine watch will add a fresh, modern touch to your casual look. This Machine watch also features a three hand movement on a stainless steel bracelet.',
    sizes: [],
    colors: ['Brown', 'Sliver', 'Black'],

    reviews: [],
  },
  // Sneakers
  {
    name: 'adidas Mens Grand Court 2.0 Training Shoes Training Shoes',
    slug: slugify('adidas Mens Grand Court 2.0 Training Shoes Training Shoes'),
    category: 'Shoes',
    brand: 'EV',
    images: ['/images/p41-1.jpg', '/images/p41-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 81.99,
    listPrice: 0,
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    countInStock: 41,
    numSales: 48,
    description:
      'Cloudfoam Comfort sockliner is ultra-soft and plush, with two layers of cushioning topped with soft, breathable mesh',
    sizes: ['8', '9', '10'],
    colors: ['White', 'Black', 'Grey'],

    reviews: [],
  },
  {
    name: "ziitop Men's Running Walking Shoes Fashion Sneakers Mesh Dress Shoes Business Oxfords Shoes Lightweight Casual Breathable Work Formal Shoes",
    slug: slugify(
      "ziitop Men's Running Walking Shoes Fashion Sneakers Mesh Dress Shoes Business Oxfords Shoes Lightweight Casual Breathable Work Formal Shoes"
    ),
    category: 'Shoes',
    brand: 'EV',
    images: ['/images/p42-1.jpg', '/images/p42-2.jpg'],
    tags: ['featured'],
    isPublished: true,
    price: 39.97,
    listPrice: 49.96,
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 42,
    numSales: 50,
    description:
      'Cloudfoam Comfort sockliner is ultra-soft and plush, with two layers of cushioning topped with soft, breathable mesh',
    sizes: ['8', '9', '10'],
    colors: ['Beige', 'Black', 'Grey'],

    reviews: [],
  },
  {
    name: 'Skechers mens Summits High Range Hands Free Slip-in Shoes Work shoe',
    slug: slugify(
      'Skechers mens Summits High Range Hands Free Slip-in Shoes Work shoe'
    ),
    category: 'Shoes',
    brand: 'EV',
    images: ['/images/p43-1.jpg', '/images/p43-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 99.99,
    listPrice: 0,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 43,
    numSales: 72,
    description:
      'Step into easy-wearing comfort with Skechers Hands Free Slip-ins™: Summits - High Range. Along with our Exclusive Heel Pillow™ holds your foot securely in place, this vegan style features a unique pop-up Skechers Slip-ins™ molded heel panel, a mesh upper with fixed laces',
    sizes: ['8', '9', '10'],
    colors: ['Navy', 'Black', 'Grey'],

    reviews: [],
  },
  {
    name: 'DLWKIPV Mens Running Shoes Tennis Cross Training Sneakers Fashion Non Slip Outdoor Walking Jogging Shoes Mesh Light Flexible Comfortable Breathable Shoes',
    slug: slugify(
      'DLWKIPV Mens Running Shoes Tennis Cross Training Sneakers Fashion Non Slip Outdoor Walking Jogging Shoes Mesh Light Flexible Comfortable Breathable Shoes'
    ),
    category: 'Shoes',
    brand: 'EV',
    images: ['/images/p44-1.jpg', '/images/p44-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 36.99,
    listPrice: 56.9,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 44,
    numSales: 72,
    description:
      'Design: Mesh vamp, ventilation. Sole anti-slip groove design, shock absorption and anti-slip. The inside of the shoe is wide and soft, bringing you a good comfortable experience',
    sizes: ['8', '9', '10', '11', '12'],
    colors: ['Brown', 'Black', 'Grey'],

    reviews: [],
  },
  {
    name: "ASICS Men's GT-2000 13 Running Shoes",
    slug: slugify("ASICS Men's GT-2000 13 Running Shoes"),
    category: 'Shoes',
    brand: 'EV',
    images: ['/images/p45-1.jpg', '/images/p45-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 179.95,
    listPrice: 200,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 45,
    numSales: 64,
    description:
      "At least 50% of the shoe's main upper material is made with recycled content to reduce waste and carbon emissions",
    sizes: ['8', '9', '10', '11'],
    colors: ['Blue', 'Black', 'Grey'],

    reviews: [],
  },
  {
    name: "Mens Wearbreeze Shoes, Urban - Ultra Comfortable Shoes, Breeze Shoes for Men, Men's Mesh Dress Sneakers Business Shoes",
    slug: slugify(
      "Mens Wearbreeze Shoes, Urban - Ultra Comfortable Shoes, Breeze Shoes for Men, Men's Mesh Dress Sneakers Business Shoes"
    ),
    category: 'Shoes',
    brand: 'EV',
    images: ['/images/p46-1.jpg', '/images/p46-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 32.99,
    listPrice: 80,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 46,
    numSales: 48,
    description:
      'Cloudfoam Comfort sockliner is ultra-soft and plush, with two layers of cushioning topped with soft, breathable mesh',
    sizes: ['8', '9', '10', '11'],
    colors: ['Green', 'Black', 'Grey'],

    reviews: [],
  },
]

const reviews  = [
  {
    rating: 1,
    title: 'Poor quality',
    comment:
      'Very disappointed. The item broke after just a few uses. Not worth the money.',
  },
  {
    rating: 2,
    title: 'Disappointed',
    comment:
      "Not as expected. The material feels cheap, and it didn't fit well. Wouldn't buy again.",
  },
  {
    rating: 2,
    title: 'Needs improvement',
    comment:
      "It looks nice but doesn't perform as expected. Wouldn't recommend without upgrades.",
  },
  {
    rating: 3,
    title: 'not bad',
    comment:
      'This product is decent, the quality is good but it could use some improvements in the details.',
  },
  {
    rating: 3,
    title: 'Okay, not great',
    comment:
      'It works, but not as well as I hoped. Quality is average and lacks some finishing.',
  },
  {
    rating: 3,
    title: 'Good product',
    comment:
      'This product is amazing, I love it! The quality is top notch, the material is comfortable and breathable.',
  },
  {
    rating: 4,
    title: 'Pretty good',
    comment:
      "Solid product! Great value for the price, but there's room for minor improvements.",
  },
  {
    rating: 4,
    title: 'Very satisfied',
    comment:
      'Good product! High quality and worth the price. Would consider buying again.',
  },
  {
    rating: 4,
    title: 'Absolutely love it!',
    comment:
      'Perfect in every way! The quality, design, and comfort exceeded all my expectations.',
  },
  {
    rating: 4,
    title: 'Exceeded expectations!',
    comment:
      'Fantastic product! High quality, feels durable, and performs well. Highly recommend!',
  },
  {
    rating: 5,
    title: 'Perfect purchase!',
    comment:
      "Couldn't be happier with this product. The quality is excellent, and it works flawlessly!",
  },
  {
    rating: 5,
    title: 'Highly recommend',
    comment:
      "Amazing product! Worth every penny, great design, and feels premium. I'm very satisfied.",
  },
  {
    rating: 5,
    title: 'Just what I needed',
    comment:
      'Exactly as described! Quality exceeded my expectations, and it arrived quickly.',
  },
  {
    rating: 5,
    title: 'Excellent choice!',
    comment:
      'This product is outstanding! Everything about it feels top-notch, from material to functionality.',
  },
  {
    rating: 5,
    title: "Couldn't ask for more!",
    comment:
      "Love this product! It's durable, stylish, and works great. Would buy again without hesitation.",
  },
]


  const settings: ISettingInput[] = [
      {
      common: {
        freeShippingMinPrice: 35,
        isMaintenanceMode: false,
        defaultTheme: 'Light',
        defaultColor: 'Gold',
        pageSize: 9,
        taxRate: 0.15,
      },
      site: {
        name: 'Essential Vital',
        description:
          'Discover premium, science-backed supplements designed to support your health and wellness goals. Shop natural, high-quality vitamins, minerals, and herbal formulas for energy, immunity, and overall well-being.',
        keywords: 'Next Ecommerce, Next.js, Tailwind CSS, MongoDB',
        url: 'https://ev-web-zeta.vercel.app/',
        logo: '/icons/EV_org-sky.svg',
        slogan: 'Spend less, enjoy more.',
        author: 'Next Ecommerce',
        copyright: '2024-2025, EssentialVital.com, Inc. or its affiliates',
        email: 'contact@EssentialVital.com',
        address: '123, Main Street, Anytown, CA, Zip 12345',
        phone: '+1 (123) 456-7890',
      },
      carousels: [
        {
          title: 'Most Popular Shoes For Sale',
          buttonCaption: 'Shop Now',
          image: '/images/banner3.jpg',
          url: '/search?category=Shoes',
        },
        {
          title: 'Best Sellers in T-Shirts',
          buttonCaption: 'Shop Now',
          image: '/images/banner1.jpg',
          url: '/search?category=T-Shirts',
        },
        {
          title: 'Best Deals on Wrist Watches',
          buttonCaption: 'See More',
          image: '/images/banner2.jpg',
          url: '/search?category=Wrist Watches',
        },
      ],
      availableLanguages: i18n.locales.map((locale: { code: string; name: string }) => ({
        code: locale.code,
        name: locale.name,
      })),
      defaultLanguage: 'en-US',
      availableCurrencies: [
        { name: 'United States Dollar', code: 'USD', symbol: '$', convertRate: 1 },
        { name: 'Euro', code: 'EUR', symbol: '€', convertRate: 0.96 },
        { name: 'UAE Dirham', code: 'AED', symbol: 'AED', convertRate: 3.67 },
        { name: 'SAUDI Riyal', code: 'SAR', symbol: 'ريال', convertRate: 3.75 }, // symbol: 'SAR',
      ],
      defaultCurrency: 'USD',
      availablePaymentMethods: [
        { name: 'PayPal', commission: 0 },
        { name: 'Stripe', commission: 0 },
        { name: 'Cash On Delivery', commission: 0 },
      ],
      defaultPaymentMethod: 'PayPal',
      availableDeliveryDates: [
        {
          name: 'Tomorrow',
          daysToDeliver: 1,
          shippingPrice: 12.9,
          freeShippingMinPrice: 0,
        },
        {
          name: 'Next 3 Days',
          daysToDeliver: 3,
          shippingPrice: 6.9,
          freeShippingMinPrice: 0,
        },
        {
          name: 'Next 5 Days',
          daysToDeliver: 5,
          shippingPrice: 4.9,
          freeShippingMinPrice: 35,
        },
      ],
      defaultDeliveryDate: 'Next 5 Days',
    },
  ]

// const appName = settings[0].site.name as string

const webPages: IWebPageInput[] = [
    {
      title: 'About Us',
      slug: 'about-us',
      content: `Welcome to **{{appName}}**, your trusted destination for quality products and exceptional service. Our journey began with a mission to bring you the best shopping experience by offering a wide range of products at competitive prices, all in one convenient platform.

At **{{appName}}**, we prioritize customer satisfaction and innovation. Our team works tirelessly to curate a diverse selection of items, from everyday essentials to exclusive deals, ensuring there's something for everyone. We also strive to make your shopping experience seamless with fast shipping, secure payments, and excellent customer support.

As we continue to grow, our commitment to quality and service remains unwavering. Thank you for choosing **{{appName}}**—we look forward to being a part of your journey and delivering value every step of the way.`,
      isPublished: true,
    },
    {
      title: 'Contact Us',
      slug: 'contact-us',
      content: `We’re here to help! If you have any questions, concerns, or feedback, please don’t hesitate to reach out to us. Our team is ready to assist you and ensure you have the best shopping experience.

**Customer Support**
For inquiries about orders, products, or account-related issues, contact our customer support team:
- **Email:** support@example.com
- **Phone:** +1 (123) 456-7890
- **Live Chat:** Available on our website from 9 AM to 6 PM (Monday to Friday).

**Head Office**
For corporate or business-related inquiries, reach out to our headquarters:
- **Address:** 1234 E-Commerce St, Suite 567, Business City, BC 12345
- **Phone:** +1 (987) 654-3210

We look forward to assisting you! Your satisfaction is our priority.
`,
      isPublished: true,
    },
    {
      title: 'Help',
      slug: 'help',
      content: `Welcome to our Help Center! We're here to assist you with any questions or concerns you may have while shopping with us. Whether you need help with orders, account management, or product inquiries, this page provides all the information you need to navigate our platform with ease.

**Placing and Managing Orders**
Placing an order is simple and secure. Browse our product categories, add items to your cart, and proceed to checkout. Once your order is placed, you can track its status through your account under the "My Orders" section. If you need to modify or cancel your order, please contact us as soon as possible for assistance.

**Shipping and Returns**
We offer a variety of shipping options to suit your needs, including standard and express delivery. For detailed shipping costs and delivery timelines, visit our Shipping Policy page. If you're not satisfied with your purchase, our hassle-free return process allows you to initiate a return within the specified timeframe. Check our Returns Policy for more details.

**Account and Support**
Managing your account is easy. Log in to update your personal information, payment methods, and saved addresses. If you encounter any issues or need further assistance, our customer support team is available via email, live chat, or phone. Visit our Contact Us page for support hours and contact details.`,
      isPublished: true,
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      content: `**Effective Date:** January 1, 2025  
**Last Updated:** May 9, 2026

## 1. Who We Are

{{appName}} ("we", "us", or "our") operates the website and e-commerce platform located at our primary domain. We are the data controller responsible for your personal information.

**Contact:**  
Email: contact@essentialvital.com  
Address: Riyadh, Saudi Arabia

---

## 2. Information We Collect

We collect the following categories of personal information:

| Category | Examples | Purpose |
|---|---|---|
| **Identity** | Full name | Account creation, order processing |
| **Contact** | Email address, phone number | Order confirmations, support |
| **Financial** | Payment card details (processed by Stripe/PayPal — we never store raw card numbers) | Processing payments |
| **Transaction** | Order history, items purchased, amounts paid | Fulfilling orders, customer support |
| **Technical** | IP address, browser type, device type, cookie identifiers | Site security, fraud prevention, analytics |
| **Usage** | Pages visited, search queries, browsing history within the site | Improving our service |
| **Marketing** | Communication preferences | Sending promotional emails (with consent) |

---

## 3. How We Use Your Information

We use your personal data for the following purposes and on the following legal bases:

- **Performance of a contract** — to process orders, payments, and deliver products you purchase.
- **Legal obligation** — to comply with applicable tax, accounting, and consumer protection laws.
- **Legitimate interests** — to detect fraud, improve our website, and provide customer support.
- **Consent** — to send marketing emails and use non-essential cookies (you may withdraw consent at any time).

---

## 4. Cookies & Tracking Technologies

We use the following types of cookies:

- **Strictly Necessary** — Essential for the site to function (session management, security). Cannot be disabled.
- **Analytics & Performance** — Help us understand how visitors use our site (e.g., page views, traffic sources). We use anonymised or pseudonymised data where possible.
- **Marketing & Advertising** — Used to deliver relevant advertisements. Only set with your explicit consent.
- **Preferences & Functionality** — Remember your settings (language, currency, theme).

You can manage your cookie preferences at any time using the cookie consent banner on our site or through your browser settings.

---

## 5. Sharing Your Information

We share your data only in these circumstances:

- **Payment Processors** — Stripe and/or PayPal to process transactions securely.
- **Delivery Partners** — Shipping carriers receive your name and address to fulfil orders.
- **Email Service Providers** — Resend to send transactional and marketing emails.
- **Cloud Infrastructure** — Vercel (hosting), MongoDB Atlas (database), Uploadthing (file storage).
- **Legal Authorities** — When required by law, court order, or to protect our legal rights.

We do **not** sell your personal information to third parties.

---

## 6. International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence, including the United States and EU member states. Where we transfer data outside the EEA, we ensure appropriate safeguards are in place (e.g., Standard Contractual Clauses).

---

## 7. Data Retention

We retain personal data for as long as necessary to fulfil the purposes described in this policy:

- **Account data:** While your account is active, plus 3 years after closure.
- **Order records:** 7 years (to comply with tax and accounting obligations).
- **Marketing consents:** Until you withdraw consent.

---

## 8. Your Rights (GDPR — EU/UK Residents)

If you are located in the EU or UK, you have the following rights:

- **Access** — Request a copy of your personal data.
- **Rectification** — Correct inaccurate or incomplete data.
- **Erasure** — Request deletion of your data ("right to be forgotten").
- **Restriction** — Ask us to limit how we use your data.
- **Portability** — Receive your data in a machine-readable format.
- **Object** — Object to processing based on legitimate interests or for direct marketing.
- **Withdraw consent** — Where processing is based on consent, you may withdraw it at any time.

To exercise any of these rights, contact us at **contact@essentialvital.com**. We will respond within **30 days**.

You also have the right to lodge a complaint with your national data protection authority.

---

## 9. Your Rights (CCPA — California Residents) {#ccpa}

If you are a California resident, the California Consumer Privacy Act (CCPA) grants you the following rights:

- **Know** — The categories and specific pieces of personal information we have collected about you.
- **Delete** — Request deletion of your personal information, subject to certain exceptions.
- **Opt-Out** — We do not sell personal information. You do not need to opt out.
- **Non-Discrimination** — We will not discriminate against you for exercising your CCPA rights.

To submit a CCPA request, email us at **contact@essentialvital.com** with the subject line "CCPA Request".

---

## 10. Children's Privacy

Our services are not directed to children under the age of 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.

---

## 11. Security

We implement industry-standard technical and organisational security measures including:
- HTTPS encryption for all data in transit.
- Tokenised payment processing (we never store raw card numbers).
- Password hashing using bcrypt.
- Regular security reviews of our infrastructure.

No system is completely secure. In the event of a data breach, we will notify affected users and relevant authorities as required by law.

---

## 12. Changes to This Policy

We may update this Privacy Policy from time to time. The "Last Updated" date at the top of this page indicates when changes were made. For material changes, we will notify you by email or a prominent notice on our website before the change becomes effective.

---

## 13. Contact Us

For any privacy-related questions or to exercise your rights:

**{{appName}}**  
Email: contact@essentialvital.com  
Address: Riyadh, Saudi Arabia`,
      isPublished: true,
    },
    {
      title: 'Conditions of Use',
      slug: 'conditions-of-use',
      content: `**Effective Date:** January 1, 2025  
**Last Updated:** May 9, 2026

## 1. Acceptance of Terms

By accessing or using the {{appName}} website and services (collectively, the "Service"), you agree to be bound by these Conditions of Use ("Terms"). If you do not agree to these Terms, please do not use the Service.

These Terms constitute a legally binding agreement between you and **{{appName}}**. We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.

---

## 2. Eligibility

You must be at least **18 years old** (or the age of legal majority in your jurisdiction) to use this Service and make purchases. By using the Service, you represent and warrant that you meet this requirement. If you are under 18, you may only use the Service with the involvement of a parent or legal guardian.

---

## 3. Account Registration

- You are responsible for maintaining the confidentiality of your account credentials.
- You agree to provide accurate, current, and complete information during registration.
- You are responsible for all activity that occurs under your account.
- Notify us immediately at **contact@essentialvital.com** if you suspect unauthorised access to your account.
- We reserve the right to terminate accounts that violate these Terms.

---

## 4. Products and Orders

**4.1 Product Descriptions**  
We strive to ensure product descriptions, images, and pricing are accurate. However, errors may occur. We reserve the right to correct errors and cancel orders placed at incorrect prices before shipment.

**4.2 Order Acceptance**  
Your order constitutes an offer to purchase. We accept your order when we send a shipment confirmation email. We reserve the right to refuse or cancel any order at our discretion, including if:
- The product is out of stock.
- There is an error in the product description or price.
- We suspect fraudulent activity.

**4.3 Pricing**  
All prices are displayed in the selected currency and are inclusive of applicable taxes unless otherwise stated. Shipping fees are additional and displayed at checkout.

**4.4 Payment**  
We accept payment via Stripe (credit/debit card) and PayPal. All payment processing is handled by our third-party providers and is subject to their terms of service. We do not store your full payment card details.

---

## 5. Shipping and Delivery

Delivery timelines are estimates and not guarantees. We are not liable for delays caused by third-party carriers, customs, or circumstances beyond our control. Risk of loss and title for products pass to you upon delivery to the carrier.

For full details, see our **Shipping Policy** page.

---

## 6. Returns and Refunds

We offer a **30-day return policy** for new, unopened merchandise in its original condition. Some products may be excluded. To initiate a return, contact us at **contact@essentialvital.com**.

Refunds are processed to the original payment method within **5–10 business days** of receiving the returned item. Shipping costs for returns are the responsibility of the customer unless the item was defective or incorrectly sent.

For full details, see our **Returns Policy** page.

---

## 7. Intellectual Property

All content on this Service — including text, graphics, logos, images, product descriptions, and software — is the property of {{appName}} or its content suppliers and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our prior written consent.

---

## 8. Prohibited Conduct

You agree not to:

- Use the Service for any unlawful purpose or in violation of any applicable laws.
- Submit false, fraudulent, or misleading information.
- Interfere with or disrupt the security, integrity, or performance of the Service.
- Attempt to gain unauthorised access to any part of the Service.
- Use automated tools (bots, scrapers) to access or collect data from the Service.
- Post or transmit any content that is defamatory, obscene, or harmful.

Violations may result in immediate termination of your account and possible legal action.

---

## 9. User-Generated Content

By submitting reviews, ratings, or other content, you grant {{appName}} a non-exclusive, royalty-free, perpetual, worldwide licence to use, reproduce, publish, and display that content in connection with our Service. You represent that you own or have the right to submit the content and that it does not violate any third-party rights.

---

## 10. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES.

---

## 11. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {{appName}} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.

OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE **12 MONTHS** PRECEDING THE CLAIM.

---

## 12. Indemnification

You agree to indemnify, defend, and hold harmless {{appName}}, its officers, directors, employees, and agents from any claims, damages, losses, and expenses (including reasonable legal fees) arising out of your use of the Service, your violation of these Terms, or your infringement of any third-party rights.

---

## 13. Governing Law and Dispute Resolution

These Terms are governed by the laws of **Saudi Arabia**, without regard to conflict of law principles. For EU/UK users, applicable EU/UK consumer protection laws also apply and are not excluded by these Terms.

**For EU consumers:** You may use the European Commission's online dispute resolution platform at [https://ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr).

For all other disputes, you agree to submit to the exclusive jurisdiction of the courts of Riyadh, Saudi Arabia.

---

## 14. Privacy

Your use of the Service is also governed by our **Privacy Policy**, which is incorporated into these Terms by reference. Please review it carefully.

---

## 15. Termination

We may suspend or terminate your account and access to the Service at any time, for any reason, including violation of these Terms, with or without notice. Provisions that by their nature should survive termination will do so, including intellectual property rights, disclaimers, and limitations of liability.

---

## 16. Severability

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

---

## 17. Contact Us

For questions about these Terms:

**{{appName}}**  
Email: contact@essentialvital.com  
Address: Riyadh, Saudi Arabia`,
      isPublished: true,
    },
    {
      title: 'Customer Service',
      slug: 'customer-service',
      content: `At **{{appName}}**, our customer service team is here to ensure you have the best shopping experience. Whether you need assistance with orders, product details, or returns, we are committed to providing prompt and helpful support.

If you have questions or concerns, please reach out to us through our multiple contact options:
- **Email:** support@example.com
- **Phone:** +1 (123) 456-7890
- **Live Chat:** Available on our website for instant assistance

We also provide helpful resources such as order tracking, product guides, and FAQs to assist you with common inquiries. Your satisfaction is our priority, and we’re here to resolve any issues quickly and efficiently. Thank you for choosing us!`,
      isPublished: true,
    },
    {
      title: 'Returns Policy',
      slug: 'returns-policy',
      content: `**Effective Date:** January 1, 2025

## Our 30-Day Return Guarantee

At {{appName}}, your satisfaction is our priority. If you are not completely satisfied with your purchase, you may return eligible items within **30 days** of the delivery date.

---

## Eligibility

To be eligible for a return, your item must be:

- Unused and in the same condition as received.
- In the original packaging with all tags and accessories included.
- Returned within 30 days of the delivery date.

**Non-returnable items:**
- Opened nutritional supplements or consumables (for health and safety reasons).
- Gift cards.
- Items marked "Final Sale" at the time of purchase.

---

## How to Initiate a Return

1. Email us at **contact@essentialvital.com** with your order number and reason for return.
2. We will send you a Return Merchandise Authorisation (RMA) number and return instructions within **2 business days**.
3. Ship the item back using a trackable shipping method. Retain your shipping receipt.

---

## Refunds

- Once your return is received and inspected, we will notify you by email.
- Approved refunds are processed to your **original payment method** within **5–10 business days**.
- Original shipping fees are non-refundable unless the return is due to our error (defective or wrong item).

---

## Exchanges

We do not offer direct exchanges. If you need a different item, please return your original purchase for a refund and place a new order.

---

## Damaged or Defective Items

If you receive a damaged or defective product, please contact us within **7 days** of receipt with photos of the damage. We will arrange a replacement or full refund at no cost to you.

---

## EU/UK Statutory Rights

If you are based in the EU or UK, you have the statutory right to cancel your order within **14 days** of receiving it (the "cooling-off period") without giving any reason. To exercise this right, notify us at **contact@essentialvital.com** before the 14-day period expires. The cost of return shipping is your responsibility unless the goods are defective.

---

## Contact

For all returns enquiries:  
Email: **contact@essentialvital.com**`,
      isPublished: true,
    },
    {
      title: 'Careers',
      slug: 'careers',
      content: 'careers Content',
      isPublished: true,
    },
    {
      title: 'Blog',
      slug: 'blog',
      content: 'Blog Content',
      isPublished: true,
    },
    {
      title: 'Sell Products',
      slug: 'sell',
      content: `Sell Products Content`,
      isPublished: true,
    },
    {
      title: 'Become Affiliate',
      slug: 'become-affiliate',
      content: 'Become Affiliate Content',
      isPublished: true,
    },
    {
      title: 'Advertise Your Products',
      slug: 'advertise',
      content: 'Advertise Your Products',
      isPublished: true,
    },
    {
      title: 'Shipping Rates & Policies',
      slug: 'shipping',
      content: 'Shipping Rates & Policies',
      isPublished: true,
    },
  ]

const data: Data = {
  users,
  products,
  reviews,
  webPages,
  settings,
  headerMenus: [
    {
      name: "todaysDeals",
      href: '/search?tag=todays-deal',
    },
    {
      name: 'New Arrivals',
      href: '/search?tag=new-arrival',
    },
    {
      name: 'Featured Products',
      href: '/search?tag=featured',
    },
    {
      name: 'Best Sellers',
      href: '/search?tag=best-seller',
    },
    {
      name: 'Browsing History',
      href: '#browsing-history',
    },
    {
      name: 'Customer Service',
      href: '/page/customer-service',
    },
    {
      name: 'About Us',
      href: '/page/about-us',
    },
    {
      name: 'Help',
      href: '/page/help',
    },
  ],
  carousels: [
    {
      title: 'Most Popular Shoes For Sale',
      buttonCaption: 'Shop Now',
      image: '/images/banner3.jpg',
      url: '/search?category=Shoes',
      isPublished: true,
    },
    {
      title: 'Best Sellers in T-Shirts',
      buttonCaption: 'Shop Now',
      image: '/images/banner1.jpg',
      url: '/search?category=T-Shirts',
      isPublished: true,
    },
    {
      title: 'Best Deals on Wrist Watches',
      buttonCaption: 'See More',
      image: '/images/banner2.jpg',
      url: '/search?category=Wrist Watches',
      isPublished: true,
    },
  ],
 
}



export default data 


