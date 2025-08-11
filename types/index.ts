import { z } from 'zod'
import {
  CartSchema,
  OrderInputSchema,
  OrderItemSchema,
  ProductInputSchema,
  ShippingAddressSchema,
  UserInputSchema,
  UserSignInSchema,
  UserSignUpSchema,
  ReviewInputSchema,
  UserNameSchema,
  ProductUpdateSchema,
  ProductInputFormSchema,
  ProductUpdateFormSchema,
  WebPageInputSchema,
  WebPageUpdateSchema,
  CarouselSchema,
  DeliveryDateSchema,
  PaymentMethodSchema,
  SettingInputSchema,
  SiteCurrencySchema,
  SiteLanguageSchema,
  UserEmailSchema,
} from '@/lib/validator'

export type IReviewInput = z.infer<typeof ReviewInputSchema>
export type IReviewDetails = IReviewInput & {
  _id: string
  createdAt: string
  user: {
    name: string
  }
}

export type IProductInput = z.infer<typeof ProductInputSchema>
export type IProductUpdate = z.infer<typeof ProductUpdateSchema>
export type IProductInputForm = z.infer<typeof ProductInputFormSchema>
export type IProductFormUpdate = z.infer<typeof ProductUpdateFormSchema>


export type Data = {
  settings: ISettingInput[]
  webPages: IWebPageInput[]
  users: IUserInput[]
  products: IProductInput[]
  reviews: {
    title: string
    rating: number
    comment: string
  }[]
  headerMenus: {
    name: string
    href: string
  }[]
  carousels: {
    image: string
    url: string
    title: string
    buttonCaption: string
    isPublished: boolean
  }[]

}


// Order
export type IOrderInput = z.infer<typeof OrderInputSchema>
export type IOrderList = IOrderInput & {
  _id: string
  user: {
    name: string
    email: string
  }
  createdAt: Date
}
export type OrderItem = z.infer<typeof OrderItemSchema>
export type Cart = z.infer<typeof CartSchema>
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>

// user
export type IUserInput = z.infer<typeof UserInputSchema>
export type IUserSignIn = z.infer<typeof UserSignInSchema>
export type IUserSignUp = z.infer<typeof UserSignUpSchema>
export type IUserName = z.infer<typeof UserNameSchema>
export type IUserEmail = z.infer<typeof UserEmailSchema>

// webpage
export type IWebPageInput = z.infer<typeof WebPageInputSchema>
export type IWebPageUpdate = z.infer<typeof WebPageUpdateSchema>

// setting
export type ICarousel = z.infer<typeof CarouselSchema>
export type ISettingInput = z.infer<typeof SettingInputSchema>
export type ClientSetting = ISettingInput & { currency: string }
export type SiteLanguage = z.infer<typeof SiteLanguageSchema>
export type SiteCurrency = z.infer<typeof SiteCurrencySchema>
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>
export type DeliveryDate = z.infer<typeof DeliveryDateSchema>