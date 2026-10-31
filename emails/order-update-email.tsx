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
  Tailwind,
  Text,
} from '@react-email/components'

export type OrderUpdateEmailProps = {
  siteName: string
  siteUrl: string
  logoUrl: string
  orderId: string
  heading: string
  message: string
  trackingNumber?: string
  trackingUrl?: string
  amount?: string
  amountLabel?: string
}

export default function OrderUpdateEmail({
  siteName,
  siteUrl,
  logoUrl,
  orderId,
  heading,
  message,
  trackingNumber,
  trackingUrl,
  amount,
  amountLabel = 'Refund amount',
}: OrderUpdateEmailProps) {
  return (
    <Html>
      <Preview>{heading}</Preview>
      <Tailwind>
        <Head />
        <Body className='bg-white font-sans'>
          <Container className='max-w-xl'>
            <Img
              src={logoUrl}
              alt={`${siteName} logo`}
              width='140'
              height='40'
              className='mx-auto mb-4'
            />
            <Heading>{heading}</Heading>
            <Text className='text-gray-600'>{message}</Text>
            <Section className='my-4 rounded-lg border border-solid border-gray-300 p-4'>
              <Text className='mb-0 text-gray-500'>Order</Text>
              <Link
                href={`${siteUrl.replace(/\/$/, '')}/account/orders/${orderId}`}
              >
                {orderId}
              </Link>
              {trackingNumber && (
                <>
                  <Text className='mb-0 mt-4 text-gray-500'>Tracking number</Text>
                  {trackingUrl ? (
                    <Link href={trackingUrl}>{trackingNumber}</Link>
                  ) : (
                    <Text className='mt-0'>{trackingNumber}</Text>
                  )}
                </>
              )}
              {amount && (
                <>
                  <Text className='mb-0 mt-4 text-gray-500'>{amountLabel}</Text>
                  <Text className='mt-0'>{amount}</Text>
                </>
              )}
            </Section>
            <Text className='text-gray-500 text-xs'>
              {siteName} · {siteUrl}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
