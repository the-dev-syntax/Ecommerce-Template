import { z } from 'zod'

// Validate lazily so build-time static generation can run without every
// runtime secret present. Provider getters throw a readable error on use.
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
  MOYASAR_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY: z.string().min(1).optional(),
  MOYASAR_SECRET_KEY: z.string().min(1).optional(),
  MOYASAR_WEBHOOK_SECRET: z.string().min(1).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) return cached

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }

  cached = parsed.data
  return cached
}

export interface MoyasarConfig {
  publishableKey: string
  secretKey: string
  webhookSecret?: string
}

export function getMoyasarSecretKey(): string {
  const secretKey = getServerEnv().MOYASAR_SECRET_KEY

  if (!secretKey)
    throw new Error('Moyasar is not configured: MOYASAR_SECRET_KEY is missing')

  return secretKey
}

export function getMoyasarWebhookSecret(): string | undefined {
  return getServerEnv().MOYASAR_WEBHOOK_SECRET
}

export function getMoyasarConfig(): MoyasarConfig {
  const env = getServerEnv()
  const publishableKey =
    env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY ?? env.MOYASAR_PUBLISHABLE_KEY
  const secretKey = getMoyasarSecretKey()

  if (!publishableKey)
    throw new Error(
      'Moyasar is not configured: MOYASAR_PUBLISHABLE_KEY (or NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY) is missing'
    )

  return {
    publishableKey,
    secretKey,
    webhookSecret: env.MOYASAR_WEBHOOK_SECRET,
  }
}

export function isMoyasarConfigured(): boolean {
  try {
    getMoyasarConfig()
    return true
  } catch {
    return false
  }
}

export function getMoyasarPublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY ??
    process.env.MOYASAR_PUBLISHABLE_KEY ??
    ''
  )
}
