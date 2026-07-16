import { describe, expect, it } from 'vitest'
import { detectImageType, validateImageBytes, validateImageUpload } from '@/lib/security/image-upload'

function buffer(bytes: number[]) {
  return Uint8Array.from(bytes).buffer
}

describe('image upload validation', () => {
  it('detects supported image signatures', () => {
    expect(detectImageType(buffer([0xff, 0xd8, 0xff, 0x00]))?.mime).toBe('image/jpeg')
    expect(detectImageType(buffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe('image/png')
    expect(detectImageType(buffer([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.mime).toBe('image/webp')
  })

  it('rejects a declared image whose bytes are not an image', () => {
    const bytes = buffer([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74])
    const file = new File([bytes], 'avatar.jpg', { type: 'image/jpeg' })

    expect(validateImageUpload({ file, buffer: bytes, maxBytes: 1024 })).toEqual({
      ok: false,
      error: 'Format non supporté. Utilisez JPG, PNG ou WEBP.',
    })
  })

  it('rejects a MIME type that conflicts with the file signature', () => {
    const bytes = buffer([0xff, 0xd8, 0xff, 0x00])
    const file = new File([bytes], 'avatar.png', { type: 'image/png' })

    expect(validateImageUpload({ file, buffer: bytes, maxBytes: 1024 }).ok).toBe(false)
  })

  it('rejects oversized files', () => {
    const bytes = buffer([0xff, 0xd8, 0xff, 0x00])
    const file = new File([bytes], 'avatar.jpg', { type: 'image/jpeg' })

    expect(validateImageUpload({ file, buffer: bytes, maxBytes: 2 }).ok).toBe(false)
  })

  it('validates a stored object without trusting its extension', () => {
    const bytes = buffer([0xff, 0xd8, 0xff, 0x00])

    expect(validateImageBytes({
      buffer: bytes,
      size: 4,
      declaredMime: 'image/jpeg',
      maxBytes: 1024,
    })).toEqual({
      ok: true,
      image: { mime: 'image/jpeg', extension: 'jpg' },
    })
  })
})
