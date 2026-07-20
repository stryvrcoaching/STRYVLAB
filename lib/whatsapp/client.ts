type WhatsAppSendResult = { messageId: string | null }

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION
  if (!accessToken || !phoneNumberId || !apiVersion) throw new Error('WhatsApp credentials are not configured')

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
  })

  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status}): ${await response.text()}`)
  const payload = await response.json() as { messages?: Array<{ id?: string }> }
  return { messageId: payload.messages?.[0]?.id ?? null }
}
