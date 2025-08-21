import { Resend } from 'resend'
import PurchaseReceiptEmail from './purchase-receipt'
import { IOrder } from '@/lib/db/models/order.model'
import { SENDER_EMAIL, SENDER_NAME } from '@/lib/constants'
import AskReviewOrderItemsEmail from './ask-review-order-items'
import VerificationEmail from './verification-email'
 


const resend = new Resend(process.env.RESEND_API_KEY as string)

export const sendPurchaseReceipt = async ({ order }: { order: IOrder }) => {
  await resend.emails.send({
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: (order.user as { email: string }).email,
    subject: `Order Confirmation`,
    react: <PurchaseReceiptEmail order={order} />,
  })
}

export const sendAskReviewOrderItems = async ({ order }: { order: IOrder }) => {
  const oneDayFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()

  await resend.emails.send({
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: (order.user as { email: string }).email,
    subject: 'Review your order items',
    react: <AskReviewOrderItemsEmail order={order} />,
    scheduledAt: oneDayFromNow,
  })
}

type SendVerificationEmailType = {
  name?: string
  email: string
  token: string
  update?: boolean
}
export const sendVerificationEmail = async ( props: SendVerificationEmailType ) => {
  const { name, email, token, update } = props
  try {
    await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: email,
      subject: `Verify your email address`,
      react: <VerificationEmail email={email} token={token} name={name || 'User'} update={update} />,
    })
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

