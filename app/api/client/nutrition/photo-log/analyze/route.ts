export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService } from "@/lib/nutrition/preps-service"
import { normalizeClientLang } from "@/lib/client/resolve-language"
import { analyzePhotoMeal, PhotoMealModelParseError } from "@/lib/nutrition/photo-log-analyze"
import { buildPhotoMealFinalResult, resolvePhotoMealSessionStatus } from "@/lib/nutrition/photo-log-finalize"
import { jsonWithRequestTiming, RequestTiming } from "@/lib/perf/request-timing"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"
import { resolveOwnedPhotoMealSessionWithRetry } from "@/lib/nutrition/photo-log-session-access"
import { checkDistributedRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit"

const PHOTO_BUCKET = "nutrition-photo-logs"
const STORAGE_DOWNLOAD_RETRY_MS = [180, 420, 900] as const
// Cap : si le total base64 dépasse ~18 MB, on bascule sur les signed URLs
// pour éviter de saturer le contexte OpenAI ou un timeout réseau
const MAX_BASE64_TOTAL_BYTES = 18 * 1024 * 1024

const schema = z.object({
  session_id: z.string().uuid(),
  manual_detail: z.string().max(1200).optional(),
})

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPhotoLoadFailure(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("load failed") ||
    normalized.includes("load file head") ||
    normalized.includes("image_fetch_failed") ||
    normalized.includes("storage_download_failed")
  )
}

async function toDataUrlFromStorage(db: ReturnType<typeof createSupabaseService>, storagePath: string) {
  let lastMessage = "storage_download_failed"

  for (let attempt = 0; attempt < STORAGE_DOWNLOAD_RETRY_MS.length; attempt += 1) {
    const { data, error } = await db.storage.from(PHOTO_BUCKET).download(storagePath)
    if (!error && data) {
      const contentType = data.type || "image/jpeg"
      const buffer = Buffer.from(await data.arrayBuffer())
      return `data:${contentType};base64,${buffer.toString("base64")}`
    }

    lastMessage = error?.message ?? "storage_download_failed"
    if (attempt < STORAGE_DOWNLOAD_RETRY_MS.length - 1) {
      await sleep(STORAGE_DOWNLOAD_RETRY_MS[attempt])
    }
  }

  throw new Error(lastMessage)
}

function mapAnalyzeErrorMessage(message: string, lang: ClientLang) {
  const normalized = message.toLowerCase()

  if (isPhotoLoadFailure(message)) {
    return ct(lang, "nutrition.photo.log.error.readFailed")
  }

  if (normalized.includes("ai_unavailable")) {
    return "ai_unavailable"
  }

  if (
    normalized.includes("analysis_parse_failed") ||
    normalized.includes("json") ||
    normalized.includes("expected ','") ||
    normalized.includes("unexpected")
  ) {
    return ct(lang, "nutrition.photo.log.error.analysis")
  }

  return ct(lang, "nutrition.photo.log.error.analysis")
}

async function loadPersonalFoodHints(db: ReturnType<typeof createSupabaseService>, clientId: string) {
  const { data } = await db
    .from("food_items")
    .select("id, name_fr, category_l1, category_l2, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .eq("client_id", clientId)
    .limit(40)

  const rows = Array.isArray(data) ? data : []

  return rows.map((item: any) => ({
    id: String(item.id),
    name_fr: String(item.name_fr ?? ""),
    category_l1: item.category_l1,
    category_l2: item.category_l2 ?? null,
    item_key: item.item_key ?? null,
    kcal_per_100g: Number(item.kcal_per_100g ?? 0),
    protein_per_100g: Number(item.protein_per_100g ?? 0),
    carbs_per_100g: Number(item.carbs_per_100g ?? 0),
    fat_per_100g: Number(item.fat_per_100g ?? 0),
    fiber_per_100g: Number(item.fiber_per_100g ?? 0),
  })).filter((item: any) => item.name_fr)
}

// M1 : Utilitaire SSE — encode un événement dans le format text/event-stream
function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const timing = new RequestTiming()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })
  timing.checkpoint("auth")

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })
  timing.checkpoint("parse_body")

  // M1 : Détection du mode streaming (header Accept: text/event-stream)
  const wantsStream = req.headers.get("accept")?.includes("text/event-stream") ?? false

  const db = createSupabaseService()
  const { session, client } = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId: body.data.session_id,
    user,
    sessionSelect: "id, meal_type, manual_weight_g, source_context, clarification_answers, client_photo_meal_log_photos(kind, signed_url, storage_path, position_index, created_at)",
    clientSelect: "id",
  })
  if (!session || !client) {
    return NextResponse.json({ error: "nutrition_photo_log_session_not_found" }, { status: 404 })
  }

  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: "client_nutrition_photo_analyze",
    subject: String((client as any).id),
    maxRequests: 20,
    windowSeconds: 60 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const lang = normalizeClientLang(undefined)
  timing.checkpoint("resolve_client")
  timing.checkpoint("load_session")

  const storedPhotos = (Array.isArray((session as any).client_photo_meal_log_photos) ? (session as any).client_photo_meal_log_photos : [])
    .sort((a: any, b: any) => {
      const byPosition = Number(a.position_index ?? 0) - Number(b.position_index ?? 0)
      if (byPosition !== 0) return byPosition
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
    })
  const photos = (
    await Promise.all(
      storedPhotos.map(async (photo: any) => {
        let signedUrl = photo.signed_url ? String(photo.signed_url) : null
        const storagePath = photo.storage_path ? String(photo.storage_path) : null
        let modelUrl: string | null = null

        if (storagePath) {
          const { data: signed } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 10)
          if (signed?.signedUrl) signedUrl = signed.signedUrl
          try {
            modelUrl = await toDataUrlFromStorage(db, storagePath)
          } catch {
            modelUrl = null
          }
        }

        return signedUrl ? { ...photo, signed_url: signedUrl, model_url: modelUrl ?? signedUrl } : null
      }),
    )
  ).filter(Boolean) as Array<any>

  // P0-3 : Vérification de la taille totale des base64
  // Si le total dépasse le cap, on bascule sur les signed URLs pour éviter de saturer le contexte OpenAI
  const totalBase64Bytes = photos.reduce((sum: number, photo: any) => {
    const url = String(photo.model_url ?? "")
    return sum + (url.startsWith("data:") ? url.length : 0)
  }, 0)
  const useSignedUrlsInstead = totalBase64Bytes > MAX_BASE64_TOTAL_BYTES
  if (useSignedUrlsInstead) {
    console.warn(`[photo-log] base64_cap_exceeded: ${Math.round(totalBase64Bytes / 1024 / 1024)}MB total, using signed_urls instead`)
  }

  const photoUrls = photos
    .map((photo: any) => {
      if (useSignedUrlsInstead) return photo.signed_url || null
      return photo.model_url || photo.signed_url || null
    })
    .filter(Boolean)
  if (photoUrls.length < 1) {
    return NextResponse.json({ error: "At least one photo is required" }, { status: 400 })
  }

  // M1 : Exécution commune (stream ou JSON)
  // Le cœur de la logique est factorisé pour les deux modes
  const runAnalysis = async (emit: (type: string, data: unknown) => void) => {
    const manualWeightG = Number((session as any).manual_weight_g ?? 0) || null
    const manualDetail = body.data.manual_detail?.trim() || null
    const clientId = String((client as any).id)
    const personalFoodHints = await loadPersonalFoodHints(db, clientId)
    const primaryPhotoEvidence = photos.map((photo: any, index: number) => ({
      index: Number(photo.position_index ?? index) + 1,
      kind: photo.kind,
      signed_url: photo.model_url || photo.signed_url,
    }))

    // M1 : Signal de progression — photos chargées, analyse principale va démarrer
    emit("progress", { step: "analyzing", message: ct(lang, "nutrition.photo.log.progress.identifying") })

    let analyzeResult
    try {
      analyzeResult = await analyzePhotoMeal({
        photoUrls,
        photoEvidence: primaryPhotoEvidence,
        manualWeightG,
        manualDetail,
        personalFoodHints,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "analysis_failed"
      const remotePhotoEvidence = photos.map((photo: any, index: number) => ({
        index: Number(photo.position_index ?? index) + 1,
        kind: photo.kind,
        signed_url: photo.signed_url,
      })).filter((photo: any) => photo.signed_url)
      const remotePhotoUrls = remotePhotoEvidence.map((photo: any) => photo.signed_url)
      const canRetryWithRemoteUrls =
        isPhotoLoadFailure(message) &&
        remotePhotoUrls.length === photoUrls.length &&
        remotePhotoUrls.some((url: string, index: number) => url !== photoUrls[index])

      if (!canRetryWithRemoteUrls) {
        throw cause
      }

      // M1 : Signal de progression — nouvelle tentative avec URLs distantes
      emit("progress", { step: "retrying", message: ct(lang, "nutrition.photo.log.progress.retrying") })

      analyzeResult = await analyzePhotoMeal({
        photoUrls: remotePhotoUrls,
        photoEvidence: remotePhotoEvidence,
        manualWeightG,
        manualDetail,
        personalFoodHints,
      })
    }
    const { analysis, perf } = analyzeResult
    timing.checkpoint("analyze_ai")

    // M1 : Signal de progression — analyse terminée, calcul nutritionnel en cours
    emit("progress", { step: "computing", message: ct(lang, "nutrition.photo.log.progress.computing") })

    if ((session as any).meal_type) {
      analysis.meal_type = (session as any).meal_type
    }

    const answers = ((session as any).clarification_answers ?? {}) as Record<string, string>
    const finalResult = buildPhotoMealFinalResult({ analysis, answers, lang })
    const nextStatus = resolvePhotoMealSessionStatus(finalResult)
    timing.checkpoint("finalize")

    // M1 : Signal de progression — sauvegarde
    emit("progress", { step: "saving", message: ct(lang, "nutrition.photo.log.progress.saving") })

    const { error: updateError } = await db
      .from("client_photo_meal_logs")
      .update({
        status: nextStatus,
        source_context: analysis.source_context ?? (session as any).source_context ?? "plate_home_v1",
        scale_weight_g: analysis.scale_weight_g,
        scale_weight_confidence: analysis.scale_weight_confidence,
        analysis_summary: analysis,
        analysis_result: finalResult,
      })
      .eq("id", body.data.session_id)
      .eq("client_id", clientId)

    if (updateError) throw new Error(updateError.message)
    timing.checkpoint("persist")

    return { analysis, result: finalResult, perf }
  }

  // M1 : Mode streaming SSE
  if (wantsStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (type: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEvent(type, data)))
        }

        try {
          const data = await runAnalysis(emit)
          emit("result", { data })
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "analysis_failed"
          if (cause instanceof PhotoMealModelParseError) {
            console.warn("[photo-log] model_parse_failed")
          } else {
            console.warn("[photo-log] analyze_failed", { message })
          }
          const mapped = mapAnalyzeErrorMessage(message, lang)
          emit("error", { error: mapped, status: mapped === "ai_unavailable" ? 503 : 500 })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Désactiver le buffering nginx pour Vercel/Railway
      },
    })
  }

  // Mode JSON classique (rétrocompatibilité)
  try {
    const data = await runAnalysis(() => {}) // emit vide = no-op
    return jsonWithRequestTiming(timing, { data })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "analysis_failed"
    if (cause instanceof PhotoMealModelParseError) {
      console.warn("[photo-log] model_parse_failed")
    } else {
      console.warn("[photo-log] analyze_failed", { message })
    }
    const mapped = mapAnalyzeErrorMessage(message, lang)
    return jsonWithRequestTiming(timing, { error: mapped }, { status: mapped === "ai_unavailable" ? 503 : 500 })
  }
}
