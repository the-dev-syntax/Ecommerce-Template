const base = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'

export const paypal = {
  createOrder: async function createOrder(price: number, currency = 'USD') {
    const accessToken = await generateAccessToken()
    const url = `${base}/v2/checkout/orders`
    const response = await fetch(url, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency.toUpperCase(),
              value: price.toFixed(2),
            },
          },
        ],
      }),
    })
    return handleResponse(response)
  },
  capturePayment: async function capturePayment(orderId: string) {
    const accessToken = await generateAccessToken()
    const url = `${base}/v2/checkout/orders/${orderId}/capture`
    const response = await fetch(url, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return handleResponse(response)
  },
  getOrder: async function getOrder(orderId: string) {
    const accessToken = await generateAccessToken()
    const response = await fetch(`${base}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return handleResponse(response)
  },
  getCapture: async function getCapture(captureId: string) {
    const accessToken = await generateAccessToken()
    const response = await fetch(`${base}/v2/payments/captures/${captureId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return handleResponse(response)
  },
  refundCapture: async function refundCapture(
    captureId: string,
    amount: number,
    currency: string,
    requestId: string
  ) {
    const accessToken = await generateAccessToken()
    const response = await fetch(
      `${base}/v2/payments/captures/${captureId}/refund`,
      {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'PayPal-Request-Id': requestId,
        },
        body: JSON.stringify({
          amount: {
            value: amount.toFixed(2),
            currency_code: currency.toUpperCase(),
          },
        }),
      }
    )
    return handleResponse(response)
  },
}

async function generateAccessToken() {
  const { PAYPAL_CLIENT_ID, PAYPAL_APP_SECRET } = process.env

  const auth = Buffer.from(PAYPAL_CLIENT_ID + ':' + PAYPAL_APP_SECRET).toString('base64')

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  const jsonData = await handleResponse(response)
  return jsonData.access_token
}
// 200 = request is successful and data is returned
// 201 = a new resource is created
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleResponse(response: any) {
  if (response.status >= 200 && response.status < 300) {
    return response.json()
  }

  const errorMessage = await response.text()
  const error = new Error(errorMessage) as Error & { status?: number }
  error.status = response.status
  throw error
}