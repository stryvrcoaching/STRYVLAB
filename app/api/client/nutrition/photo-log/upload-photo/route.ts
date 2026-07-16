export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService } from "@/lib/nutrition/preps-service"
import { PHOTO_LOG_SERVER_MAX_FILE_BYTES } from "@/lib/nutrition/photo-log-upload"
import { jsonWithRequestTiming, RequestTiming } from "@/lib/perf/request-timing"
import { resolveOwnedPhotoMealSessionWithRetry } from "@/lib/nutrition/photo-log-session-access"
import { validateImageBytes, validateImageUpload } from "@/lib/security/image-upload"
import { checkDistributedRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit"

const BUCKET = "nutrition-photo-logs"
const PHOTO_KINDS = ["context", "top", "side", "scale_zoom", "leftovers"] as const
const MAX_PHOTOS_PER_SESSION = 16
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

function isPhotoKind(value: string): value is typeof PHOTO_KINDS[number] {
  return PHOTO_KINDS.includes(value as typeof PHOTO_KINDS[number])
}

function extensionForMime(contentType: string) {
  return IMAGE_EXTENSIONS[contentType as keyof typeof IMAGE_EXTENSIONS] ?? null
}

function isOwnedPreparedPath(params: {
  storagePath: string
  clientId: string
  sessionId: string
  kind: typeof PHOTO_KINDS[number]
}) {
  const prefix = `${params.clientId}/${params.sessionId}/`
  if (!params.storagePath.startsWith(prefix)) return false

  const filename = params.storagePath.slice(prefix.length)
  return new RegExp(`^[0-9a-f-]{36}-${params.kind}\\.(jpg|png|webp)$`).test(filename)
}

async function authenticateRequest() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 }) as NextResponse, db: null, user: null }
  }

  const db = createSupabaseService()
  return { error: null as NextResponse | null, db, user }
}

async function createPhotoRecord(params: {
  db: ReturnType<typeof createSupabaseService>
  sessionId: string
  kind: typeof PHOTO_KINDS[number]
  storagePath: string
}) {
  const { db, sessionId, kind, storagePath } = params

  const { count: existingCount } = await db
    .from("client_photo_meal_log_photos")
    .select("*", { count: "exact", head: true })
    .eq("photo_meal_log_id", sessionId)

  if (Number(existingCount ?? 0) >= MAX_PHOTOS_PER_SESSION) {
    await db.storage.from(BUCKET).remove([storagePath])
    return {
      error: NextResponse.json({ error: "Maximum photo count reached" }, { status: 409 }) as NextResponse,
      data: null,
    }
  }

  const { data, error } = await db
    .from("client_photo_meal_log_photos")
    .insert({
      photo_meal_log_id: sessionId,
      kind,
      storage_path: storagePath,
      signed_url: null,
      position_index: existingCount ?? 0,
    })
    .select("*")
    .single()

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) as NextResponse, data: null }
  }

  const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60)
  return {
    error: null as NextResponse | null,
    data: {
      ...(data as Record<string, unknown>),
      signed_url: signed?.signedUrl ?? null,
    },
  }
}

export async function POST(req: NextRequest) {
  const timing = new RequestTiming()
  const auth = await authenticateRequest()
  if (auth.error) return auth.error
  if (!auth.db || !auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, user } = auth
  timing.checkpoint("auth")

  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: "client_nutrition_photo_upload",
    subject: user.id,
    maxRequests: 40,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const contentType = req.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null)
    const intent = String(body?.intent ?? "")
    const sessionId = String(body?.session_id ?? "")
    const kind = String(body?.kind ?? "")

    if (!sessionId || !kind) {
      return jsonWithRequestTiming(timing, { error: "session_id and kind are required" }, { status: 400 })
    }
    if (!isPhotoKind(kind)) {
      return jsonWithRequestTiming(timing, { error: "Unsupported photo kind" }, { status: 400 })
    }

    const resolved = await resolveOwnedPhotoMealSessionWithRetry({
      db,
      sessionId,
      user,
      sessionSelect: "id, client_id",
      clientSelect: "id",
    })
    if (!resolved.session || !resolved.client) {
      return jsonWithRequestTiming(timing, { error: "Session not found" }, { status: 404 })
    }
    const clientId = String(resolved.client.id)
    timing.checkpoint("session_lookup")

    if (intent === "prepare") {
      const fileSize = Number(body?.file_size ?? 0)
      const uploadContentType = String(body?.content_type ?? "")
      const fileExtension = extensionForMime(uploadContentType)

      if (!fileExtension) {
        return jsonWithRequestTiming(timing, { error: "Unsupported photo format" }, { status: 415 })
      }
      if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > PHOTO_LOG_SERVER_MAX_FILE_BYTES) {
        return jsonWithRequestTiming(timing, { error: "Photo is too large" }, { status: 413 })
      }

      const storagePath = `${clientId}/${sessionId}/${randomUUID()}-${kind}.${fileExtension}`
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(storagePath)
      if (error || !data?.signedUrl) {
        return jsonWithRequestTiming(timing, { error: error?.message ?? "Upload URL failed" }, { status: 500 })
      }
      timing.checkpoint("signed_upload_url")

      return jsonWithRequestTiming(timing, {
        upload_url: data.signedUrl,
        storage_path: storagePath,
        token: data.token,
        bucket: BUCKET,
      })
    }

    if (intent === "complete") {
      const storagePath = String(body?.storage_path ?? "")
      if (!isOwnedPreparedPath({ storagePath, clientId, sessionId, kind })) {
        return jsonWithRequestTiming(timing, { error: "Invalid storage_path" }, { status: 400 })
      }

      const { data: storedFile, error: downloadError } = await db.storage.from(BUCKET).download(storagePath)
      if (downloadError || !storedFile) {
        return jsonWithRequestTiming(timing, { error: "Uploaded photo not found" }, { status: 404 })
      }

      const storedBuffer = await storedFile.arrayBuffer()
      const validation = validateImageBytes({
        buffer: storedBuffer,
        size: storedFile.size,
        declaredMime: storedFile.type,
        maxBytes: PHOTO_LOG_SERVER_MAX_FILE_BYTES,
      })
      if (!validation.ok) {
        await db.storage.from(BUCKET).remove([storagePath])
        return jsonWithRequestTiming(timing, { error: validation.error }, { status: 400 })
      }

      const created = await createPhotoRecord({
        db,
        sessionId,
        kind,
        storagePath,
      })
      if (created.error) return created.error
      timing.checkpoint("create_photo_record")
      return jsonWithRequestTiming(timing, { data: created.data }, { status: 201 })
    }

    return jsonWithRequestTiming(timing, { error: "Unsupported upload intent" }, { status: 400 })
  }

  const formData = await req.formData()
  const sessionId = String(formData.get("session_id") ?? "")
  const kind = String(formData.get("kind") ?? "")
  const file = formData.get("file") as File | null

  if (!sessionId || !kind || !file) {
    return jsonWithRequestTiming(timing, { error: "session_id, kind and file are required" }, { status: 400 })
  }
  if (!isPhotoKind(kind)) {
    return jsonWithRequestTiming(timing, { error: "Unsupported photo kind" }, { status: 400 })
  }
  const resolved = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId,
    user,
    sessionSelect: "id, client_id",
    clientSelect: "id",
  })
  if (!resolved.session || !resolved.client) {
    return jsonWithRequestTiming(timing, { error: "Session not found" }, { status: 404 })
  }
  const clientId = String(resolved.client.id)
  timing.checkpoint("session_lookup")

  const arrayBuffer = await file.arrayBuffer()
  const validation = validateImageUpload({
    file,
    buffer: arrayBuffer,
    maxBytes: PHOTO_LOG_SERVER_MAX_FILE_BYTES,
  })
  if (!validation.ok) {
    return jsonWithRequestTiming(timing, { error: validation.error }, { status: 400 })
  }

  const storagePath = `${clientId}/${sessionId}/${randomUUID()}-${kind}.${validation.image.extension}`
  const buffer = Buffer.from(arrayBuffer)
  const upload = await db.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: validation.image.mime,
    upsert: false,
  })
  if (upload.error) return jsonWithRequestTiming(timing, { error: upload.error.message }, { status: 500 })
  timing.checkpoint("storage_upload")

  const created = await createPhotoRecord({
    db,
    sessionId,
    kind,
    storagePath,
  })
  if (created.error) return created.error
  timing.checkpoint("create_photo_record")
  return jsonWithRequestTiming(timing, { data: created.data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const sessionId = String(params.get("session_id") ?? "")
  const photoId = String(params.get("photo_id") ?? "")

  if (!sessionId || !photoId) {
    return NextResponse.json({ error: "session_id and photo_id are required" }, { status: 400 })
  }

  const db = createSupabaseService()
  const resolved = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId,
    user,
    sessionSelect: "id",
    clientSelect: "id",
  })
  if (!resolved.client) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 404 })
  if (!resolved.session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const { data: photo, error: photoError } = await db
    .from("client_photo_meal_log_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("photo_meal_log_id", sessionId)
    .single()

  if (photoError || !photo) {
    return NextResponse.json({ error: photoError?.message ?? "Photo not found" }, { status: 404 })
  }

  const storagePath = String((photo as any).storage_path ?? "")
  if (storagePath) {
    await db.storage.from(BUCKET).remove([storagePath])
  }

  const { error } = await db
    .from("client_photo_meal_log_photos")
    .delete()
    .eq("id", photoId)
    .eq("photo_meal_log_id", sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
