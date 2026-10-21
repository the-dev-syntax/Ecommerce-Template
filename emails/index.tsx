import { Resend } from 'resend'
import PurchaseReceiptEmail from './purchase-receipt'
import { OrderWithUser } from '@/lib/db/models/order.model'
import { SENDER_EMAIL, SENDER_NAME } from '@/lib/constants'
import { getSetting } from '@/lib/actions/setting.actions'
import AskReviewOrderItemsEmail from './ask-review-order-items'
import VerificationEmail from './verification-email'
import PasswordResetEmail, { PasswordResetEmailProps } from './password-reset-email'
import { VerificationPropsType } from '@/types'
 


const resend = new Resend(process.env.RESEND_API_KEY as string)

async function getSender() {
  const { email } = await getSetting()
  return {
    from: `${email.senderName || SENDER_NAME} <${email.senderEmail || SENDER_EMAIL}>`,
    replyTo: email.replyTo || undefined,
  }
}

export const sendPurchaseReceipt = async ({ order }: { order: OrderWithUser }) => {
  const sender = await getSender()
  await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: order.user.email,
    subject: `Order Confirmation`,
    react: <PurchaseReceiptEmail order={order} />,
  })
}

export const sendAskReviewOrderItems = async ({ order }: { order: OrderWithUser }) => {
  const oneDayFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  const sender = await getSender()

  await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: order.user.email,
    subject: 'Review your order items',
    react: <AskReviewOrderItemsEmail order={order} />,
    scheduledAt: oneDayFromNow,
  })
}

export const sendPasswordResetEmail = async (props: PasswordResetEmailProps) => {
  const sender = await getSender()
  await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: props.email,
    subject: 'Reset your password',
    react: <PasswordResetEmail {...props} />,
  })
}

export const sendVerificationEmail = async ( props: VerificationPropsType ) => {
  const { name, email, token, update } = props
  try {
    const sender = await getSender()
    await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to: email,
      subject: `${token} -DON'T REPLY- Verify your email address`,
      react: <VerificationEmail email={email} token={token} name={name || 'User'} update={update} />,
    })
  } catch (error) {
    console.error('Error sending verification email')
    throw error
  }
}

