import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { addDaysToDateKey, findUtcForLocalTime, getLocalTimeParts, utcRangeForPhysiologicalDate } from "@/lib/client/checkin/timeWindows"
import {
  computePhysiologicalDate,
  PHYSIOLOGICAL_DAY_CUTOFF_HOUR,
  PHYSIOLOGICAL_DAY_CUTOFF_MINUTE,
} from "@/lib/nutrition/physiological-date"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service().from("coach_clients").select("id").eq("user_id", userId).single()
  return data?.id ?? null
}

const schema = z.object({
  amount_ml: z.number().positive().max(5000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function resolveLoggedAtForPhysiologicalDate(targetDate: string, timezone: string, reference: Date): Date {
  const currentPhysiologicalDate = computePhysiologicalDate(reference, timezone)
  if (targetDate === currentPhysiologicalDate) return reference

  const { hour, minute } = getLocalTimeParts(reference, timezone)
  const minutesSinceMidnight = hour * 60 + minute
  const cutoffMinutes = PHYSIOLOGICAL_DAY_CUTOFF_HOUR * 60 + PHYSIOLOGICAL_DAY_CUTOFF_MINUTE
  const calendarDate = minutesSinceMidnight < cutoffMinutes ? addDaysToDateKey(targetDate, 1) : targetDate
  const exactMatch = findUtcForLocalTime(calendarDate, hour, minute, timezone)
  if (exactMatch) return exactMatch

  const { start } = utcRangeForPhysiologicalDate(targetDate, timezone)
  return new Date(start.getTime() + 12 * 60 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const timezone = await resolveClientTimezone(service(), clientId)
  const date = searchParams.get('date') ?? computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(date, timezone)

  const { data, error } = await service()
    .from("client_water_logs")
    .select("id, amount_ml, logged_at")
    .eq("client_id", clientId)
    .gte("logged_at", physiologicalStart.toISOString())
    .lte("logged_at", physiologicalEnd.toISOString())
    .order("logged_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { amount_ml } = body.data
  const db = service()
  const timezone = await resolveClientTimezone(db, clientId)
  const reference = new Date()
  const targetDate = body.data.date ?? computePhysiologicalDate(reference, timezone)
  const loggedAt = resolveLoggedAtForPhysiologicalDate(targetDate, timezone, reference)

  const { data, error } = await db.from("client_water_logs").insert({
    client_id: clientId,
    amount_ml,
    logged_at: loggedAt.toISOString(),
  }).select("id, amount_ml, logged_at").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...data })
}
