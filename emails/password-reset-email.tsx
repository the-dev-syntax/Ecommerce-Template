import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { getSetting } from '@/lib/actions/setting.actions'
import type { EmailTemplateContent } from '@/lib/email-templates'

export type PasswordResetEmailProps = {
  name: string
  email: string
  resetLink: string
  content?: EmailTemplateContent
}

const main = {
  backgroundColor: '#f8fafc',
  padding: '40px 20px',
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
}

const container = {
  maxWidth: '560px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  margin: '0 auto',
  padding: '48px 40px',
  border: '1px solid #e2e8f0',
}

const heading = {
  fontSize: '26px',
  fontWeight: '700',
  color: '#1e293b',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#475569',
  margin: '0 0 20px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}

const footer = {
  fontSize: '13px',
  color: '#64748b',
  marginTop: '32px',
  paddingTop: '20px',
  borderTop: '1px solid #e2e8f0',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto 28px',
  display: 'block',
}

export default async function PasswordResetEmail({
  name,
  email,
  resetLink,
  content,
}: PasswordResetEmailProps) {
  const { site, brand } = await getSetting()
  const logoSrc = new URL(brand.emailLogo || site.logo, site.url).toString()

  return (
    <Html>
      <Head />
      <Preview>{content?.heading || `Reset your ${site.name} password`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={logoSrc}
            alt={`${site.name} Logo`}
            width='120'
            height='40'
            style={logo}
          />
          <Heading style={heading}>
            {content?.heading || 'Reset your password'}
          </Heading>
          <Text style={text}>Hello {name || 'User'},</Text>
          <Text style={text}>
            {content?.intro ||
              `We received a request to reset the password for ${email}. Choose a new password using the button below. This link expires in 30 minutes.`}
          </Text>
          <Section style={buttonContainer}>
            <Link href={resetLink} style={button}>
              Reset Password
            </Link>
          </Section>
          <Text style={text}>
            If you did not request this, you can safely ignore this email. Your
            password will not change.
          </Text>
          <Text style={footer}>
            {content?.footer || `This is an automated message from ${site.name}.`}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
