import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { removeAccountStorage } from '@/lib/privacy/account-purge'

describe('account purge storage cleanup', () => {
  it('recursively lists folders and removes every discovered file', async () => {
    const list = vi.fn(async (prefix: string) => {
      if (prefix === 'client-1') {
        return {
          data: [
            { name: 'avatar.jpg', id: 'file-1', metadata: {} },
            { name: 'nested', id: null, metadata: null },
          ],
          error: null,
        }
      }
      if (prefix === 'client-1/nested') {
        return {
          data: [{ name: 'progress.jpg', id: 'file-2', metadata: {} }],
          error: null,
        }
      }
      return { data: [], error: null }
    })
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const db = {
      storage: { from: vi.fn(() => ({ list, remove })) },
    } as unknown as SupabaseClient

    const deleted = await removeAccountStorage(db, [{
      bucket: 'profile-photos',
      prefixes: ['client-1'],
      exactPaths: ['client-1/avatar.jpg'],
    }])

    expect(deleted).toBe(2)
    expect(list).toHaveBeenCalledWith('client-1/nested', expect.any(Object))
    expect(remove).toHaveBeenCalledWith([
      'client-1/avatar.jpg',
      'client-1/nested/progress.jpg',
    ])
  })

  it('treats an absent optional bucket as already clean', async () => {
    const remove = vi.fn()
    const db = {
      storage: {
        from: vi.fn(() => ({
          list: vi.fn().mockResolvedValue({
            data: null,
            error: { statusCode: 404, message: 'Bucket not found' },
          }),
          remove,
        })),
      },
    } as unknown as SupabaseClient

    const deleted = await removeAccountStorage(db, [{
      bucket: 'chat-attachments',
      prefixes: ['client-1'],
    }])

    expect(deleted).toBe(0)
    expect(remove).not.toHaveBeenCalled()
  })
})
