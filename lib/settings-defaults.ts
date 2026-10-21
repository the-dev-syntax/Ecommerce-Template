import data from '@/lib/data'
import type { ISettingInput } from '@/types'

/**
 * Merge a stored settings document with the Saudi defaults. Older documents
 * predate seller/tax/invoice fields, so every server read must be complete.
 */
export function withSettingDefaults(
  setting?: Partial<ISettingInput> | null
): ISettingInput {
  const defaults = data.settings[0]

  return {
    ...defaults,
    ...setting,
    brand: { ...defaults.brand, ...setting?.brand },
    seo: { ...defaults.seo, ...setting?.seo },
    features: { ...defaults.features, ...setting?.features },
    navigation: {
      header: setting?.navigation?.header ?? defaults.navigation.header,
      footer: setting?.navigation?.footer ?? defaults.navigation.footer,
    },
    email: { ...defaults.email, ...setting?.email },
    common: { ...defaults.common, ...setting?.common },
    site: { ...defaults.site, ...setting?.site },
    seller: { ...defaults.seller, ...setting?.seller },
    invoice: { ...defaults.invoice, ...setting?.invoice },
  } as ISettingInput
}
