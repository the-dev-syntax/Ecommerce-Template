import type { ISettingInput, SiteCurrency } from '@/types'

/**
 * Resolve the currency to render on the server: the cookie wins only when it
 * names a currency the store actually offers, otherwise the store default.
 */
export function resolveCurrency(
  availableCurrencies: SiteCurrency[],
  cookieValue: string | null | undefined,
  defaultCurrency: string
): string {
  if (
    cookieValue &&
    availableCurrencies.some((currency) => currency.code === cookieValue)
  ) {
    return cookieValue
  }
  return defaultCurrency
}

export function getBaseCurrency(setting: ISettingInput): SiteCurrency {
  return (
    setting.availableCurrencies.find((currency) => currency.isBase) ??
    setting.availableCurrencies.find(
      (currency) => currency.code === setting.defaultCurrency
    ) ??
    setting.availableCurrencies[0]
  )
}
