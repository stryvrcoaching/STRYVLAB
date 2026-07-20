import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWhatsAppSignature(rawBody: string, signature: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !signature?.startsWith('sha256=')) return false

  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  const received = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer)
}

export function isValidWebhookVerification(
  mode: string | null,
  token: string | null,
  expectedToken: string | undefined,
): boolean {
  return Boolean(expectedToken) && mode === 'subscribe' && token === expectedToken
}
