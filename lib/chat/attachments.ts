import type { SupabaseClient } from '@supabase/supabase-js'

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain',
])

export type ChatAttachment = {
  name: string
  type: string
  size: number
  path: string
  url?: string | null
}

export function isAllowedChatAttachment(file: File) {
  return file.size > 0 && file.size <= CHAT_ATTACHMENT_MAX_BYTES && ALLOWED_TYPES.has(file.type)
}

export async function ensureChatAttachmentBucket(db: SupabaseClient) {
  const { data } = await db.storage.getBucket(CHAT_ATTACHMENTS_BUCKET)
  if (data) return
  await db.storage.createBucket(CHAT_ATTACHMENTS_BUCKET, {
    public: false,
    fileSizeLimit: CHAT_ATTACHMENT_MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  })
}

export async function uploadChatAttachment(
  db: SupabaseClient,
  clientId: string,
  file: File,
): Promise<ChatAttachment> {
  await ensureChatAttachmentBucket(db)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'fichier'
  const path = `${clientId}/${crypto.randomUUID()}-${safeName}`
  const { error } = await db.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) throw error
  return { name: file.name, type: file.type, size: file.size, path }
}

export async function signChatAttachment(db: SupabaseClient, attachment: ChatAttachment) {
  const { data } = await db.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.path, 60 * 60)
  return { ...attachment, url: data?.signedUrl ?? null }
}
