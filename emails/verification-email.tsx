import {
  Container,
  Head,
  Html,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { getSetting } from '@/lib/actions/setting.actions';
import { VerificationPropsType } from '@/types';
import  { EMAIL_EXPIRATION_TIME } from '@/lib/constants';

const emailStyles = {
  main: {
    backgroundColor: '#f8fafc',
    padding: '40px 20px',
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    backgroundImage: 'linear-gradient(to bottom, #f0f9ff 0%, #ffffff 100%)',
    backgroundRepeat: 'no-repeat',
  },
  container: {
    maxWidth: '560px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05), 0 5px 10px rgba(0, 0, 0, 0.02)',
    margin: '0 auto',
    padding: '50px 40px',
    border: '1px solid #e2e8f0',
  },
  heading: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1e293b88',
    marginBottom: '20px',
    textAlign: 'center' as const,
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
     lineHeight: '36px',
    // color: 'transparent',
  },
  text: {
    fontSize: '16px',
    lineHeight: '26px',
    color: '#475569',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  otpContainer: {
    textAlign: 'center' as const,
    margin: '35px 0',
  },
  otpCode: {
    fontSize: '32px',
    fontWeight: '700',
    letterSpacing: '8px',
    color: '#3b82f6',
    backgroundColor: '#f1f5f9',
    padding: '18px 24px',
    borderRadius: '12px',
    display: 'inline-block',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
  },
  footer: {
    fontSize: '14px',
    color: '#64748b',
    marginTop: '40px',
    textAlign: 'center' as const,
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0',
  },
  logo: {
    margin: '0 auto 35px',
    display: 'block',
  },
  highlight: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  supportLink: {
    color: '#3b82f6',
    textDecoration: 'underline',
  }
};

export default async function VerificationEmail(props: VerificationPropsType) {
  const { email, token, name, update } = props;
  const { site } = await getSetting();
  const logoSrc = new URL(site.logo, site.url).toString();
  
  const signUpMessage = `Thank you for signing up with ${site.name}! To complete your registration, please verify your email address by entering this OTP code:`;
  const updateMessage = `You're updating your email address. Please verify your new email by entering this OTP code:`;

  return (
    <Html>
      <Head />
      <body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Img
            src={logoSrc}
            alt={`${site.name} Logo`}
            width="140"
            height="40"
            style={emailStyles.logo}
          />
          
          <Text style={emailStyles.heading}>
            Verify Your Email Address {email}
          </Text>
          
          <Text style={emailStyles.text}>
            Hello <span style={emailStyles.highlight}>{name || 'User'}</span>,
          </Text>
          
          <Text style={emailStyles.text}>
            {update ? updateMessage : signUpMessage}
          </Text>
          
          <Section style={emailStyles.otpContainer}>
            <Text style={emailStyles.otpCode}>
              {token}
            </Text>
          </Section>
          
          <Text style={emailStyles.text}>
            This verification code will expire in {EMAIL_EXPIRATION_TIME / 1000 / 60} minutes. 
            For security reasons, please do not share this code with anyone.
          </Text>
          
          <Text style={emailStyles.footer}>
            If you didn't request this email, you can safely ignore it.
            <br />
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
            <br />
            Need help? <Link href={`${site.url}/support`} style={emailStyles.supportLink}>
              Contact our support team
            </Link>
          </Text>
        </Container>
      </body>
    </Html>
  );
}
/*
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
  import { VerificationPropsType } from '@/types'
  


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
  export default async function VerificationEmail(props:  VerificationPropsType ) {
     const { email, token, name, update } = props
     const { site } = await getSetting()
    //  const verificationLink = new URL(`/verify-email?token=${token}`, site.url).toString();
     const logoSrc = new URL(site.logo, site.url).toString();
     const signUpMessage = `Thank you for signing up with ${site.name}. To complete your registration, please verify your email {email} by using the OTP below.`
     const updateMessage = `To complete your Email Update, please verify your new email ${email} by using the OTP below.`
    //  console.log('sendVerificationEmail to #################################:', email, 'with link:', verificationLink);
     console.log('sendVerificationEmail to #################################:', email, 'with OTP:', token);

     return (
      <Html>
      <Head />
      <body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Img
            src={logoSrc}
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
         {update ? updateMessage : signUpMessage}
          </Text>
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button href={verificationLink} style={emailStyles.button}>
              Verify Your Email
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
    )
  
}


------------------------------------------------------------------------------
 if (update) {
    <Html>
      <Head />
      <body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Img
            src={logoSrc}
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
            To complete your Email update, please verify your email {email} by clicking the button below.
          </Text>
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button href={verificationLink} style={emailStyles.button}>
              Verify Your Email
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
  } else {
    return (
      <Html>
      <Head />
      <body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Img
            src={logoSrc}
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
            Thank you for signing up with {site.name}. To complete your registration, please verify your email {email} by clicking the button below.
          </Text>
          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Button href={verificationLink} style={emailStyles.button}>
              Verify Your Email
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
    )
  }

*/