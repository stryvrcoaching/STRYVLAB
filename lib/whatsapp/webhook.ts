export type WhatsAppInboundMessage = {
  id: string
  from: string
  type: 'text' | 'audio' | 'unsupported'
  text: string | null
  raw: Record<string, unknown>
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Extract every message in a Meta webhook delivery, not just the first one. */
export function parseWhatsAppWebhook(payload: unknown): WhatsAppInboundMessage[] {
  if (!isRecord(payload) || payload.object !== 'whatsapp_business_account') return []

  const messages: WhatsAppInboundMessage[] = []
  for (const entry of asRecords(payload.entry)) {
    for (const change of asRecords(entry.changes)) {
      const value = isRecord(change.value) ? change.value : null
      if (!value) continue

      for (const message of asRecords(value.messages)) {
        const id = stringValue(message.id)
        const from = stringValue(message.from)
        if (!id || !from) continue

        const rawType = stringValue(message.type)
        const textNode = isRecord(message.text) ? stringValue(message.text.body) : null
        messages.push({
          id,
          from: from.replace(/\D/g, ''),
          type: rawType === 'text' ? 'text' : rawType === 'audio' ? 'audio' : 'unsupported',
          text: textNode,
          raw: message,
        })
      }
    }
  }

  return messages
}

/** Meta sends status events to the same endpoint; they are acknowledged without side effects. */
export function isWhatsAppWebhook(payload: unknown): boolean {
  return isRecord(payload) && payload.object === 'whatsapp_business_account'
}
