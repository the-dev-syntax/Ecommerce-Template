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
  const text = (value: string | undefined, fallback: string) =>
    value && value.trim() ? value : fallback

  return {
    ...defaults,
    ...setting,
    brand: {
      ...defaults.brand,
      ...setting?.brand,
      logoDark: text(setting?.brand?.logoDark, defaults.brand.logoDark),
      favicon: text(setting?.brand?.favicon, defaults.brand.favicon),
      emailLogo: text(setting?.brand?.emailLogo, defaults.brand.emailLogo),
      socialLinks:
        setting?.brand?.socialLinks?.length
          ? setting.brand.socialLinks
          : defaults.brand.socialLinks,
    },
    seo: {
      ...defaults.seo,
      ...setting?.seo,
      titleTemplate: text(
        setting?.seo?.titleTemplate,
        defaults.seo.titleTemplate
      ),
      defaultDescription: text(
        setting?.seo?.defaultDescription,
        defaults.seo.defaultDescription
      ),
      ogImage: text(setting?.seo?.ogImage, defaults.seo.ogImage),
    },
    features: { ...defaults.features, ...setting?.features },
    navigation: {
      header: setting?.navigation?.header?.length
        ? setting.navigation.header
        : defaults.navigation.header,
      footer: setting?.navigation?.footer?.length
        ? setting.navigation.footer
        : defaults.navigation.footer,
    },
    email: {
      ...defaults.email,
      ...setting?.email,
      senderName: text(
        setting?.email?.senderName,
        defaults.email.senderName
      ),
      senderEmail: text(
        setting?.email?.senderEmail,
        defaults.email.senderEmail
      ),
    },
    emailTemplates: {
      receipt: {
        ...defaults.emailTemplates.receipt,
        ...setting?.emailTemplates?.receipt,
      },
      review: {
        ...defaults.emailTemplates.review,
        ...setting?.emailTemplates?.review,
      },
      reset: {
        ...defaults.emailTemplates.reset,
        ...setting?.emailTemplates?.reset,
      },
      verification: {
        ...defaults.emailTemplates.verification,
        ...setting?.emailTemplates?.verification,
      },
    },
    common: { ...defaults.common, ...setting?.common },
    site: { ...defaults.site, ...setting?.site },
    seller: { ...defaults.seller, ...setting?.seller },
    invoice: { ...defaults.invoice, ...setting?.invoice },
  } as ISettingInput
}
