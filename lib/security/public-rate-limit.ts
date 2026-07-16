import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

type RateLimitRow = {
  allowed: boolean
  retry_after_seconds: number
}

type DistributedRateLimitParams = {
  db: SupabaseClient
  req: NextRequest
  scope: string
  maxRequests: number
  windowSeconds: number
  subject?: string | null
}

export type DistributedRateLimitDecision = {
  allowed: boolean
  retryAfterSeconds: number
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

function hashBucket(parts: string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex')
}

function parseRateLimitRow(data: unknown): RateLimitRow | null {
  const candidate = Array.isArray(data) ? data[0] : data
  if (!candidate || typeof candidate !== 'object') return null

  const row = candidate as Partial<RateLimitRow>
  if (typeof row.allowed !== 'boolean') return null
  if (!Number.isFinite(row.retry_after_seconds)) return null

  return {
    allowed: row.allowed,
    retry_after_seconds: Math.max(1, Math.ceil(row.retry_after_seconds as number)),
  }
}

async function consumeBucket(params: {
  db: SupabaseClient
  bucketKey: string
  maxRequests: number
  windowSeconds: number
}): Promise<DistributedRateLimitDecision> {
  const { data, error } = await params.db.rpc('consume_public_api_rate_limit', {
    p_bucket_key: params.bucketKey,
    p_max_requests: params.maxRequests,
    p_window_seconds: params.windowSeconds,
  })

  if (error) {
    console.error('[distributed-rate-limit] unavailable:', error.message)
    return { allowed: false, retryAfterSeconds: 60 }
  }

  const row = parseRateLimitRow(data)
  if (!row) {
    console.error('[distributed-rate-limit] invalid database response')
    return { allowed: false, retryAfterSeconds: 60 }
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: row.retry_after_seconds,
  }
}

export async function checkDistributedRateLimit(
  params: DistributedRateLimitParams,
): Promise<DistributedRateLimitDecision> {
  const ipBucket = hashBucket([params.scope, 'ip', getClientIp(params.req)])
  const ipDecision = await consumeBucket({
    db: params.db,
    bucketKey: ipBucket,
    maxRequests: params.maxRequests,
    windowSeconds: params.windowSeconds,
  })

  if (!ipDecision.allowed || !params.subject) return ipDecision

  const subjectBucket = hashBucket([params.scope, 'subject', params.subject])
  return consumeBucket({
    db: params.db,
    bucketKey: subjectBucket,
    maxRequests: params.maxRequests,
    windowSeconds: params.windowSeconds,
  })
}

export const checkPublicRateLimit = checkDistributedRateLimit

export function rateLimitResponse(decision: DistributedRateLimitDecision) {
  return NextResponse.json(
    { error: 'Trop de tentatives. Réessayez plus tard.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(decision.retryAfterSeconds),
      },
    },
  )
}
