function normalizeHex(hex: string) {
  const value = hex.trim().replace('#', '')
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    return value
      .split('')
      .map((char) => char + char)
      .join('')
  }
  return /^[0-9a-fA-F]{6}$/.test(value) ? value : null
}

/**
 * Tailwind theme colours are stored as HSL components so they can be injected
 * into the existing `hsl(var(--primary))` tokens.
 */
export function hexToHsl(hex: string): string | null {
  const value = normalizeHex(hex)
  if (!value) return null

  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min

  let hue = 0
  let saturation = 0

  if (delta !== 0) {
    saturation =
      lightness > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min)

    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0)
        break
      case g:
        hue = (b - r) / delta + 2
        break
      default:
        hue = (r - g) / delta + 4
    }
    hue /= 6
  }

  return `${Math.round(hue * 360)} ${Math.round(
    saturation * 100
  )}% ${Math.round(lightness * 100)}%`
}

export function hexForeground(hex: string): string {
  const value = normalizeHex(hex)
  if (!value) return '0 0% 100%'

  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

  return luminance > 0.6 ? '20 14.3% 4.1%' : '0 0% 100%'
}

export function fontStack(fontFamily?: string) {
  switch (fontFamily) {
    case 'cairo':
      return 'var(--font-cairo), var(--font-geist-sans), sans-serif'
    case 'system':
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    case 'serif':
      return 'Georgia, "Times New Roman", serif'
    default:
      return 'var(--font-geist-sans), var(--font-geist-mono), sans-serif'
  }
}
