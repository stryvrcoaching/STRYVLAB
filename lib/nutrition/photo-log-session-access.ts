import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"

type AuthUser = {
  id: string
  email?: string | null
}

type OwnedPhotoLogSessionResult = {
  session: Record<string, any> | null
  client: Record<string, any> | null
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function mergeSelect(base: string, required: string[]) {
  const existing = new Set(
    base
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )

  for (const field of required) {
    if (!existing.has(field)) existing.add(field)
  }

  return Array.from(existing).join(", ")
}

export async function resolveOwnedPhotoMealSession(params: {
  db: SupabaseClient
  sessionId: string
  user: AuthUser
  sessionSelect: string
  clientSelect?: string
}): Promise<OwnedPhotoLogSessionResult> {
  const { db, sessionId, user, sessionSelect, clientSelect = "id, user_id, email" } = params
  const tag = `[session:${sessionId?.slice(0, 8)}]`

  const legacyClient = await resolveClientFromUser(
    user.id,
    user.email ?? undefined,
    db,
    clientSelect,
  )

  if (legacyClient) {
    const { data: legacySession, error: legacySessionError } = await db
      .from("client_photo_meal_logs")
      .select(sessionSelect)
      .eq("id", sessionId)
      .eq("client_id", String((legacyClient as any).id))
      .maybeSingle()

    if (!legacySessionError && legacySession) {
      return {
        session: legacySession as Record<string, any>,
        client: legacyClient as Record<string, any>,
      }
    }
    console.error(`${tag} [photo-log-session] legacyClient found (id=${(legacyClient as any).id}) but session not found by client_id. legacySessionError=${JSON.stringify(legacySessionError)}`)
  } else {
    console.error(`${tag} [photo-log-session] resolveClientFromUser returned null for user_id=${user.id} email=${user.email}`)
  }

  const { data: session, error: sessionError } = await db
    .from("client_photo_meal_logs")
    .select(mergeSelect(sessionSelect, ["client_id"]))
    .eq("id", sessionId)
    .maybeSingle()

  if (sessionError || !session) {
    console.error(`${tag} [photo-log-session] session row not found. error=${JSON.stringify(sessionError)}`)
    return { session: null, client: null }
  }

  const clientId = String((session as any).client_id ?? "")
  if (!clientId) {
    console.error(`${tag} [photo-log-session] session found but client_id is empty`)
    return { session: null, client: null }
  }

  const [{ data: coachProfile }, { data: client, error: clientError }] = await Promise.all([
    db
      .from("coach_profiles")
      .select("id")
      .eq("coach_id", user.id)
      .maybeSingle(),
    db
      .from("coach_clients")
      .select(mergeSelect(clientSelect, ["id", "user_id", "email"]))
      .eq("id", clientId)
      .maybeSingle(),
  ])

  if (clientError || !client) {
    console.error(`${tag} [photo-log-session] coach_clients lookup failed for client_id=${clientId}. error=${JSON.stringify(clientError)}`)
    return { session: null, client: null }
  }

  const isCoachUser = Boolean(coachProfile)
  const ownsByUserId = String((client as any).user_id ?? "") === user.id
  const ownsByEmail =
    normalizeEmail((client as any).email) !== null &&
    normalizeEmail((client as any).email) === normalizeEmail(user.email)

  console.error(`${tag} [photo-log-session] ownership check: isCoach=${isCoachUser} ownsByUserId=${ownsByUserId} ownsByEmail=${ownsByEmail} client.user_id=${(client as any).user_id} user.id=${user.id} client.email=${(client as any).email} user.email=${user.email}`)

  if (!ownsByUserId && !ownsByEmail) {
    console.error(`${tag} [photo-log-session] ownership denied`)
    return { session: null, client: null }
  }

  if (ownsByEmail && !ownsByUserId) {
    await db
      .from("coach_clients")
      .update({ user_id: user.id })
      .eq("id", clientId)
  }

  return {
    session: session as Record<string, any>,
    client: client as Record<string, any>,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function resolveOwnedPhotoMealSessionWithRetry(params: {
  db: SupabaseClient
  sessionId: string
  user: AuthUser
  sessionSelect: string
  clientSelect?: string
  attempts?: number
  retryMs?: number[]
}) {
  const {
    // 6 tentatives pour couvrir le lag de réplication Supabase
    attempts = 6,
    // Backoff progressif jusqu'à ~5s total
    retryMs = [200, 400, 800, 1500, 2000],
    ...rest
  } = params

  let lastResolved: OwnedPhotoLogSessionResult = { session: null, client: null }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Toujours utiliser le client Supabase SERVICE (pas le client user) pour éviter
    // les problèmes de RLS et de réplication sur les read replicas
    lastResolved = await resolveOwnedPhotoMealSession(rest)
    if (lastResolved.session && lastResolved.client) {
      return lastResolved
    }

    if (attempt < attempts - 1) {
      await sleep(retryMs[Math.min(attempt, retryMs.length - 1)] ?? 200)
    }
  }

  return lastResolved
}
