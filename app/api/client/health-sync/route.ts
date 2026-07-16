import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const bodySchema = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(100),
  platform: z.enum(['ios', 'android']),
  scopes: z.array(z.enum(['steps', 'sleep', 'weight', 'restingHeartRate'])).min(1),
  steps: z.number().int().min(0).max(200000).optional(),
  sleep_minutes: z.number().int().min(0).max(1440).optional(),
  resting_heart_rate: z.number().int().min(30).max(220).optional(),
  weight_kg: z.number().min(20).max(300).optional(),
  source_details: z.record(z.string().max(200).optional()).default({}),
})

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authenticatedClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id')
  return client ? { client, db } : null
}

export async function GET() {
  const context = await authenticatedClient()
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: connection }, { data: latest }] = await Promise.all([
    context.db
      .from('client_health_connections')
      .select('platform, scopes, consented_at, last_synced_at, revoked_at')
      .eq('client_id', context.client.id)
      .maybeSingle(),
    context.db
      .from('client_health_daily_summaries')
      .select('local_date, steps, sleep_minutes, resting_heart_rate, weight_kg, synced_at')
      .eq('client_id', context.client.id)
      .order('local_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return NextResponse.json({ connection, latest })
}

export async function POST(request: NextRequest) {
  const context = await authenticatedClient()
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid health data' }, { status: 400 })
  }

  const data = parsed.data
  const now = new Date().toISOString()
  const { error: connectionError } = await context.db
    .from('client_health_connections')
    .upsert({
      client_id: context.client.id,
      platform: data.platform,
      scopes: data.scopes,
      consented_at: now,
      last_synced_at: now,
      revoked_at: null,
      updated_at: now,
    }, { onConflict: 'client_id' })

  if (connectionError) return NextResponse.json({ error: 'Unable to save health connection' }, { status: 500 })

  const { error: summaryError } = await context.db
    .from('client_health_daily_summaries')
    .upsert({
      client_id: context.client.id,
      local_date: data.local_date,
      timezone: data.timezone,
      platform: data.platform,
      steps: data.steps ?? null,
      sleep_minutes: data.sleep_minutes ?? null,
      resting_heart_rate: data.resting_heart_rate ?? null,
      weight_kg: data.weight_kg ?? null,
      source_details: data.source_details,
      synced_at: now,
      updated_at: now,
    }, { onConflict: 'client_id,local_date,platform' })

  if (summaryError) return NextResponse.json({ error: 'Unable to save health summary' }, { status: 500 })
  return NextResponse.json({ ok: true, synced_at: now })
}
