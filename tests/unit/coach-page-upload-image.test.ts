import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CoachPageUploadError,
  COACH_PAGE_MAX_SOURCE_BYTES,
  uploadCoachPageImage,
} from '@/lib/coach-page/upload-image'

describe('uploadCoachPageImage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://cdn.example/photo.jpg' }),
      }),
    )
    // prepareCoachPageImage uses createImageBitmap in browser — mock for large files
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 4000,
        height: 3000,
        close: vi.fn(),
      })),
    )
  })

  it('rejects oversized sources client-side', async () => {
    const big = new Blob([new Uint8Array(COACH_PAGE_MAX_SOURCE_BYTES + 1)], {
      type: 'image/jpeg',
    })
    await expect(uploadCoachPageImage(big, 'gallery', 'big.jpg')).rejects.toBeInstanceOf(
      CoachPageUploadError,
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects HEIC', async () => {
    const file = new File([new Uint8Array(100)], 'photo.heic', {
      type: 'image/heic',
    })
    await expect(uploadCoachPageImage(file, 'profile')).rejects.toThrow(/HEIC/)
  })

  it('returns signed url on success for small files', async () => {
    const file = new File([new Uint8Array(100)], 'ok.jpg', { type: 'image/jpeg' })
    await expect(uploadCoachPageImage(file, 'about')).resolves.toBe(
      'https://cdn.example/photo.jpg',
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/coach-page/upload',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('surfaces API error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Fichier trop lourd' }),
      }),
    )
    const file = new File([new Uint8Array(100)], 'ok.jpg', { type: 'image/jpeg' })
    await expect(uploadCoachPageImage(file, 'cover')).rejects.toThrow('Fichier trop lourd')
  })
})
