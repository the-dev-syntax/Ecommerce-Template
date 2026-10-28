/**
 * Split an incoming pathname into its locale and the locale-less path.
 *
 * The locale is matched as an exact first segment (`/fr`, `/fr/...`,
 * `/en-US`, ...) so routes such as `/friends-page` or `/archives` are not
 * mistaken for the `fr` locale. Edge-safe: no Node dependencies.
 */
export function splitLocaleFromPathname(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string
) {
  const localeMatch = pathname.match(
    new RegExp(`^/(${locales.join('|')})(?=/|$)`, 'i')
  )
  // Normalize the casing to the configured locale code.
  const locale = localeMatch
    ? locales.find(
        (candidate) =>
          candidate.toLowerCase() === localeMatch[1].toLowerCase()
      ) ?? localeMatch[1]
    : defaultLocale
  const pathnameWithoutLocale = localeMatch
    ? pathname.slice(locale.length + 1) || '/'
    : pathname

  return { locale, pathnameWithoutLocale }
}
