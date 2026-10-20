export interface MoyasarPaymentResult {
  id: string
  status: string
  amount: number
  currency: string
}

export interface MoyasarFormOptions {
  element: string | HTMLElement
  amount: number
  currency: string
  description: string
  publishable_api_key: string
  callback_url: string
  metadata?: Record<string, string>
  methods?: string[]
  supported_networks?: string[]
  apple_pay?: {
    country: string
    label: string
    validate_merchant_url: string
    supported_countries?: string[]
    merchant_capabilities?: string[]
    version?: number
  }
  language?: string
  fixed_width?: boolean
  on_completed?: (payment: MoyasarPaymentResult) => void | Promise<void>
  on_failure?: (error: string) => void
  on_redirect?: (url: string) => void
}

declare global {
  interface Window {
    Moyasar?: {
      init: (options: MoyasarFormOptions) => unknown
    }
  }
}

export {}
