import type { ISettingInput, SiteCurrency } from '@/types'

export function getBaseCurrency(setting: ISettingInput): SiteCurrency {
  return (
    setting.availableCurrencies.find((currency) => currency.isBase) ??
    setting.availableCurrencies.find(
      (currency) => currency.code === setting.defaultCurrency
    ) ??
    setting.availableCurrencies[0]
  )
}
