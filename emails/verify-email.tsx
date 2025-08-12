import {
    Container,
    Head,
    Html,
    Img,
    Link,
    Section,
    Text,
    Button,
  } from '@react-email/components' 
  import { getSetting } from '@/lib/actions/setting.actions'
  


  const emailStyles = {
  main: {
    backgroundColor: '#f4f4f7',
    padding: '40px 20px',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  container: {
    maxWidth: '600px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    margin: '0 auto',
    padding: '40px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  text: {
    fontSize: '16px',
    lineHeight: '24px',
    color: '#333333',
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    padding: '12px 24px',
    borderRadius: '6px',
    textAlign: 'center' as const,
    display: 'inline-block',
    textDecoration: 'none',
  },
  footer: {
    fontSize: '14px',
    color: '#666666',
    marginTop: '30px',
    textAlign: 'center' as const,
  },
  logo: {
    margin: '0 auto 30px',
    display: 'block',
  },
};
  export default async function VerificationEmail({ email, token, name }: { email: string, token: string, name: string }) {
     const { site } = await getSetting()
     const verificationLink = `${site.url}/api/verify-email?token=${token}`

    return (
      <Html>
      <Head />
      <body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Img
            src="https://yourapp.com/logo.png"
            alt={`${site.name} Logo`}
            width="120"
            height="40"
            style={emailStyles.logo}
          />
          <Text style={emailStyles.heading}>Verify Your Email Address</Text>
          <Text style={emailStyles.text}>
            Hello {name || 'User'},
          </Text>
          <Text style={emailStyles.text}>
            `Thank you for signing up with ${site.name}! To complete your registration, please verify your email ${email} by clicking the button below.`
          </Text>
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button href={verificationLink} style={emailStyles.button}>
              Verify Email
            </Button>
          </Section>
          <Text style={emailStyles.text}>
            If the button doesn’t work, you can copy and paste this link into your browser:
          </Text>
          <Text style={emailStyles.text}>
            <Link href={verificationLink} style={{ color: '#2563eb', wordBreak: 'break-all' }}>
              {verificationLink}
            </Link>
          </Text>
          <Text style={emailStyles.footer}>
            If you didn’t request this email, you can safely ignore it.
            <br />
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
            <br />
            <Link href={`${site.url}/support`} style={{ color: '#666666' }}>
              Contact Support
            </Link>
          </Text>
        </Container>
      </body>
    </Html>
  )}