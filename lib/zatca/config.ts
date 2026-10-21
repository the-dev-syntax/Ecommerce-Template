import type { EGS, EGSCredentials, EGSUnitInfo } from 'zatca-sdk'

export type ZatcaEnvironment = 'sandbox' | 'production'

export function getZatcaEnvironment(): ZatcaEnvironment {
  const env = process.env.ZATCA_ENV?.trim().toLowerCase()
  if (env === 'production') return 'production'
  if (env === 'sandbox' || env === 'simulation') return 'sandbox'
  throw new Error('ZATCA_ENV must be "sandbox" or "production"')
}

interface PersistedEgsState {
  egsUnit?: EGSUnitInfo
  egsState?: Record<string, unknown>
}

function parseEgsState(raw: string): PersistedEgsState {
  const trimmed = raw.trim()
  const json = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8')
  return JSON.parse(json) as PersistedEgsState
}

export async function loadZatcaEgs(): Promise<EGS> {
  const raw = process.env.ZATCA_EGS_STATE
  if (!raw) {
    throw new Error(
      'ZATCA_EGS_STATE is missing. Onboard the EGS and store its state in the environment.'
    )
  }

  const parsed = parseEgsState(raw)
  if (!parsed.egsUnit || !parsed.egsState) {
    throw new Error('ZATCA_EGS_STATE must include egsUnit and egsState')
  }

  const { EGS: EGSClass } = await import('zatca-sdk')
  const egs = new EGSClass(parsed.egsUnit, getZatcaEnvironment())
  egs.setState(parsed.egsState)
  return egs
}

export async function getZatcaCredentials(
  egs?: EGS
): Promise<EGSCredentials> {
  const instance = egs ?? (await loadZatcaEgs())
  const credentials =
    instance.getCredentials() ?? instance.getComplianceCredentials()
  if (!credentials) {
    throw new Error('ZATCA credentials are missing from ZATCA_EGS_STATE')
  }
  return credentials
}

export function getZatcaStateJson() {
  const raw = process.env.ZATCA_EGS_STATE
  if (!raw) throw new Error('ZATCA_EGS_STATE is missing')
  return JSON.stringify(parseEgsState(raw))
}

/**
 * ZATCA's sandbox CSID endpoints return a canned certificate registered to a
 * fixed VAT number (399999999900003). Reporting is only allowed for the VAT in
 * that certificate, so sandbox submissions must use it. Production certificates
 * contain the store's real VAT and never need this override.
 */
export async function getCertificateVat(certificate: string) {
  const { parseCertificate } = await import('zatca-sdk')
  const parsed = parseCertificate(certificate)
  if (!parsed.success) return null
  return parsed.data.subject.match(/\b(\d{15})\b/)?.[1] ?? null
}
