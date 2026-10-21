import { Resend } from 'resend'
import PurchaseReceiptEmail from './purchase-receipt'
import { OrderWithUser } from '@/lib/db/models/order.model'
import { SENDER_EMAIL, SENDER_NAME } from '@/lib/constants'
import { getSetting } from '@/lib/actions/setting.actions'
import { fillEmailTemplate } from '@/lib/email-templates'
import AskReviewOrderItemsEmail from './ask-review-order-items'
import VerificationEmail from './verification-email'
import PasswordResetEmail, { PasswordResetEmailProps } from './password-reset-email'
import { VerificationPropsType } from '@/types'
 


const resend = new Resend(process.env.RESEND_API_KEY as string)

async function getSender() {
  const { email, emailTemplates, site } = await getSetting()
  return {
    from: `${email.senderName || SENDER_NAME} <${email.senderEmail || SENDER_EMAIL}>`,
    replyTo: email.replyTo || undefined,
    templates: emailTemplates,
    siteName: site.name,
  }
}

export const sendPurchaseReceipt = async ({ order }: { order: OrderWithUser }) => {
  const sender = await getSender()
  await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: order.user.email,
    subject: fillEmailTemplate(sender.templates.receipt.subject, {
      orderNumber: order._id,
      siteName: sender.siteName,
    }),
    react: (
      <PurchaseReceiptEmail
        order={order}
        content={sender.templates.receipt}
      />
    ),
  })
}

export const sendAskReviewOrderItems = async ({ order }: { order: OrderWithUser }) => {
  const oneDayFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  const sender = await getSender()

  await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: order.user.email,
    subject: fillEmailTemplate(sender.templates.review.subject, {
      orderNumber: order._id,
      siteName: sender.siteName,
    }),
    react: (
      <AskReviewOrderItemsEmail
        order={order}
        content={sender.templates.review}
      />
    ),
    scheduledAt: oneDayFromNow,
  })
}

export const sendPasswordResetEmail = async (props: PasswordResetEmailProps) => {
  const sender = await getSender()
  await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: props.email,
    subject: fillEmailTemplate(sender.templates.reset.subject, {
      name: props.name,
      siteName: sender.siteName,
    }),
    react: <PasswordResetEmail {...props} content={sender.templates.reset} />,
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
      subject: fillEmailTemplate(sender.templates.verification.subject, {
        token,
        name: name || 'User',
        siteName: sender.siteName,
      }),
      react: (
        <VerificationEmail
          email={email}
          token={token}
          name={name || 'User'}
          update={update}
          content={sender.templates.verification}
        />
      ),
    })
  } catch (error) {
    console.error('Error sending verification email')
    throw error
  }
}

