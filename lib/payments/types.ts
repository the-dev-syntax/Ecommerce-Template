export type PaymentProviderId = 'moyasar' | 'stripe' | 'paypal' | 'cod'

export interface PaymentProviderDefinition {
  id: PaymentProviderId
  /** Must match the name stored in settings.availablePaymentMethods. */
  name: string
  label: string
  currencies: '*' | string[]
  supportsRefunds: boolean
  webhookPath?: string
  isConfigured: () => boolean
}
