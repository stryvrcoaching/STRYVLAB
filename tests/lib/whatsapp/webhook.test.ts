import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { blockedWriteReply, needsWriteConfirmation, unsupportedMessageReply } from '@/lib/whatsapp/messages'
import { isValidWebhookVerification, verifyWhatsAppSignature } from '@/lib/whatsapp/security'
import { parseWhatsAppWebhook } from '@/lib/whatsapp/webhook'

describe('parseWhatsAppWebhook', () => {
  it('extracts every inbound message from a Meta delivery', () => {
    const messages = parseWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [
        { id: 'wamid.1', from: '32 470 12 34 56', type: 'text', text: { body: 'Bonjour' } },
        { id: 'wamid.2', from: '32470123456', type: 'audio' },
      ] } }] }],
    })

    expect(messages).toEqual([
      expect.objectContaining({ id: 'wamid.1', from: '32470123456', type: 'text', text: 'Bonjour' }),
      expect.objectContaining({ id: 'wamid.2', from: '32470123456', type: 'audio', text: null }),
    ])
  })

  it('ignores malformed and non-WhatsApp deliveries', () => {
    expect(parseWhatsAppWebhook({ object: 'other' })).toEqual([])
    expect(parseWhatsAppWebhook({ object: 'whatsapp_business_account', entry: [{ changes: [] }] })).toEqual([])
  })
})

describe('WhatsApp safety gate', () => {
  it('blocks write-like instructions before the LLM is called', () => {
    expect(needsWriteConfirmation('Baisse ses glucides de 10 %.')).toBe(true)
    expect(needsWriteConfirmation('Comment évolue le sommeil de Sarah ?')).toBe(false)
    expect(blockedWriteReply()).toMatch(/lecture seule/i)
  })

  it('keeps voice messages outside the active scope', () => {
    expect(unsupportedMessageReply('audio')).toMatch(/vocaux/i)
  })
})

describe('Meta verification handshake', () => {
  it('only accepts the configured token', () => {
    expect(isValidWebhookVerification('subscribe', 'token', 'token')).toBe(true)
    expect(isValidWebhookVerification('subscribe', 'other', 'token')).toBe(false)
    expect(isValidWebhookVerification('subscribe', 'token', undefined)).toBe(false)
  })

  it('rejects webhook bodies with an invalid Meta signature', () => {
    const body = '{"object":"whatsapp_business_account"}'
    const secret = 'app-secret'
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

    expect(verifyWhatsAppSignature(body, signature, secret)).toBe(true)
    expect(verifyWhatsAppSignature(`${body} `, signature, secret)).toBe(false)
    expect(verifyWhatsAppSignature(body, null, secret)).toBe(false)
  })
})
