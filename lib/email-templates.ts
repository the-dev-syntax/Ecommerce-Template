import type { ISettingInput } from '@/types'

export type EmailTemplateKey = keyof ISettingInput['emailTemplates']
export type EmailTemplateContent =
  ISettingInput['emailTemplates'][EmailTemplateKey]

export function fillEmailTemplate(
  template: string,
  variables: Record<string, string | number | undefined>
) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    String(variables[key] ?? '')
  )
}
