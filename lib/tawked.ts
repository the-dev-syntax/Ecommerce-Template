import crypto from 'crypto'

const DEFAULT_BASE_URL = 'https://tawked.com'
const REQUEST_TIMEOUT_MS = 10_000

export class TawkedError extends Error {
  code: string
  status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'TawkedError'
    this.code = code
    this.status = status
  }
}

function getApiKey() {
  const key = process.env.TAWKED_SMS_API_KEY?.trim()
  if (!key) throw new TawkedError('not_configured')
  return key
}

function getBaseUrl() {
  return (process.env.TAWKED_API_BASE?.trim() || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ''
  )
}

type TawkedStartResponse = {
  id?: string
  status?: string
  expires_at?: string
  error?: string
}

type TawkedCheckResponse = {
  verified?: boolean
  status?: string
  attempts_remaining?: number
  error?: string
}

async function request<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  // One retry on network errors / 5xx, reusing the idempotency key so a
  // retried start never sends (or charges) a second code.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response
    try {
      response = await fetch(`${getBaseUrl()}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      })
    } catch {
      if (attempt === 0) continue
      throw new TawkedError('network_error')
    }

    const json = (await response.json().catch(() => ({}))) as T
    if (response.ok) return json

    if ((response.status === 502 || response.status >= 500) && attempt === 0)
      continue

    const code =
      (json as { error?: string })?.error ??
      (response.status === 404 ? 'not_found' : 'request_failed')
    throw new TawkedError(code, response.status)
  }

  throw new TawkedError('network_error')
}

/** Start a Tawked Verify OTP. Returns the server-side verification id. */
export async function startTawkedVerification(input: {
  to: string
  lang?: string
  reference?: string
  clientIp?: string
}) {
  const idempotencyKey = crypto.randomUUID()
  const result = await request<TawkedStartResponse>(
    '/v1/verify/start',
    {
      to: input.to,
      lang: input.lang === 'en' ? 'en' : 'ar',
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.clientIp ? { client_ip: input.clientIp } : {}),
    },
    idempotencyKey
  )

  if (!result.id) throw new TawkedError('invalid_response')

  return { id: result.id, expiresAt: result.expires_at }
}

/** Check an OTP. Never treat `verified` as trusted client input. */
export async function checkTawkedVerification(input: {
  id: string
  code: string
}) {
  const result = await request<TawkedCheckResponse>('/v1/verify/check', {
    id: input.id,
    code: input.code,
  })

  return {
    verified: result.verified === true,
    status: result.status ?? 'failed',
    attemptsRemaining: result.attempts_remaining,
  }
}

/** User-facing message for a Tawked error code. */
export function tawkedErrorMessage(code: string) {
  switch (code) {
    case 'invalid_destination':
      return 'Enter a valid Saudi mobile number.'
    case 'sandbox_unverified_destination':
      return 'This number cannot receive test codes. Use the account owner\u2019s phone or a live key.'
    case 'rate_limited':
      return 'Too many codes were sent to this number. Try again later.'
    case 'ip_rate_limited':
      return 'Too many attempts from this network. Try again later.'
    case 'not_configured':
      return 'Phone verification is not configured.'
    default:
      return 'We could not send the code right now. Please try again.'
  }
}
