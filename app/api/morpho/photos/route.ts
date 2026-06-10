// app/api/morpho/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  clientId: z.string().uuid(),
  position: z.string().optional(),
  source: z.enum(['assessment', 'coach_upload']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  offset: z.coerce.number().int().min(0).default(0),
})

const SIGNED_URL_TTL_SECONDS = 86400 // 24h
const CACHE_FRESH_THRESHOLD_MS = 10 * 60 * 1000 // regenerate if expiring within 10 min

// Append Supabase Image Transformation params to a signed URL
// This tells Supabase Storage to serve a resized/compressed version via its CDN
function toThumbnailUrl(signedUrl: string): string {
  try {
    const url = new URL(signedUrl)
    url.searchParams.set('width', '400')
    url.searchParams.set('quality', '60')
    return url.toString()
  } catch {
    return signedUrl
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const params = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!params.success) {
    return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  }

  const db = service()
  const { clientId, position, source, from, to, limit, offset } = params.data

  // Vérifier ownership coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let query = db
    .from('morpho_photos')
    .select(
      'id, client_id, storage_path, position, taken_at, source, notes, created_at, signed_url_cache, signed_url_expires_at',
      { count: 'exact' }
    )
    .eq('client_id', clientId)
    .order('taken_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (position) query = query.eq('position', position)
  if (source) query = query.eq('source', source)
  if (from) query = query.gte('taken_at', from)
  if (to) query = query.lte('taken_at', to)

  const { data: photos, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!photos || photos.length === 0) {
    return NextResponse.json({ photos: [], total: 0, hasMore: false })
  }

  type PhotoRow = {
    id: string
    client_id: string
    storage_path: string
    source: string
    position: string
    taken_at: string
    notes: string | null
    created_at: string
    signed_url_cache: string | null
    signed_url_expires_at: string | null
  }
  const typedPhotos = photos as PhotoRow[]
  const now = Date.now()

  // Split: fresh cache vs needs regeneration
  const freshPhotos = new Set<string>() // photo ids with fresh cached URL
  const stalePhotos: PhotoRow[] = []

  for (const p of typedPhotos) {
    const expiresAt = p.signed_url_expires_at ? new Date(p.signed_url_expires_at).getTime() : 0
    if (p.signed_url_cache && expiresAt - now > CACHE_FRESH_THRESHOLD_MS) {
      freshPhotos.add(p.id)
    } else {
      stalePhotos.push(p)
    }
  }

  // Generate signed URLs only for stale photos
  const newSignedUrlMap = new Map<string, string>()

  if (stalePhotos.length > 0) {
    const assessmentPaths = stalePhotos.filter(p => p.source === 'assessment').map(p => p.storage_path)
    const morphoPaths = stalePhotos.filter(p => p.source !== 'assessment').map(p => p.storage_path)

    const [assessmentSigned, morphoSigned] = await Promise.all([
      assessmentPaths.length > 0
        ? db.storage.from('assessment-photos').createSignedUrls(assessmentPaths, SIGNED_URL_TTL_SECONDS)
        : { data: [] },
      morphoPaths.length > 0
        ? db.storage.from('morpho-photos').createSignedUrls(morphoPaths, SIGNED_URL_TTL_SECONDS)
        : { data: [] },
    ])

    for (const entry of (assessmentSigned.data ?? [])) {
      if (entry.signedUrl && entry.path) newSignedUrlMap.set(entry.path, entry.signedUrl)
    }
    for (const entry of (morphoSigned.data ?? [])) {
      if (entry.signedUrl && entry.path) newSignedUrlMap.set(entry.path, entry.signedUrl)
    }

    // Persist new URLs to DB in background (non-blocking)
    const newExpiresAt = new Date(now + SIGNED_URL_TTL_SECONDS * 1000).toISOString()
    const cacheUpdates = stalePhotos
      .filter(p => newSignedUrlMap.has(p.storage_path))
      .map(p => ({
        id: p.id,
        signed_url_cache: newSignedUrlMap.get(p.storage_path)!,
        signed_url_expires_at: newExpiresAt,
      }))

    if (cacheUpdates.length > 0) {
      void db.from('morpho_photos').upsert(cacheUpdates, { onConflict: 'id' })
    }
  }

  // Fetch annotation metadata (thumbnail paths only, not the full URLs yet)
  const photoIds = typedPhotos.map(p => p.id)
  const { data: annotations } = await db
    .from('morpho_annotations')
    .select('photo_id, thumbnail_path')
    .in('photo_id', photoIds)
    .eq('coach_id', user.id)

  const annotationMap = new Map(
    (annotations ?? []).map((a: { photo_id: string; thumbnail_path: string | null }) => [
      a.photo_id,
      a.thumbnail_path,
    ])
  )

  // Annotation thumbnails are small — sign them normally
  const thumbnailPaths = typedPhotos
    .map(p => annotationMap.get(p.id))
    .filter(Boolean) as string[]

  const thumbUrlMap = new Map<string, string>()
  if (thumbnailPaths.length > 0) {
    const { data: thumbSigned } = await db.storage
      .from('morpho-photos')
      .createSignedUrls(thumbnailPaths, SIGNED_URL_TTL_SECONDS)
    for (const entry of (thumbSigned ?? [])) {
      if (entry.signedUrl && entry.path) thumbUrlMap.set(entry.path, entry.signedUrl)
    }
  }

  const enriched = typedPhotos.map(photo => {
    // full_url: original full-resolution (for canvas/compare)
    const fullUrl = freshPhotos.has(photo.id)
      ? photo.signed_url_cache!
      : (newSignedUrlMap.get(photo.storage_path) ?? null)

    // thumbnail_url: resized 400px wide, 60% quality (for gallery grid)
    const thumbnailGridUrl = fullUrl ? toThumbnailUrl(fullUrl) : null

    const annotationThumbPath = annotationMap.get(photo.id) ?? null
    return {
      id: photo.id,
      client_id: photo.client_id,
      storage_path: photo.storage_path,
      position: photo.position,
      taken_at: photo.taken_at,
      source: photo.source,
      notes: photo.notes,
      created_at: photo.created_at,
      // thumbnail_url: small version for gallery display
      signed_url: thumbnailGridUrl,
      // full_url: original resolution, only loaded when opening canvas/compare
      full_url: fullUrl,
      has_annotation: annotationMap.has(photo.id),
      thumbnail_url: annotationThumbPath ? (thumbUrlMap.get(annotationThumbPath) ?? null) : null,
    }
  })

  return NextResponse.json({
    photos: enriched,
    total: count ?? 0,
    hasMore: offset + limit < (count ?? 0),
  })
}
