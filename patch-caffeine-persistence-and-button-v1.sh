#!/usr/bin/env bash
set -euo pipefail

ROUTE="app/api/client/water/route.ts"
MODAL="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$ROUTE" ]; then
  echo "❌ Route introuvable: $ROUTE"
  exit 1
fi

if [ ! -f "$MODAL" ]; then
  echo "❌ Modal introuvable: $MODAL"
  exit 1
fi

cp "$ROUTE" "$ROUTE.bak-caffeine-fix-$(date +%Y%m%d-%H%M%S)"
cp "$MODAL" "$MODAL.bak-caffeine-button-$(date +%Y%m%d-%H%M%S)"

cat > "$ROUTE" <<'TS'
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { utcRangeForPhysiologicalDate } from "@/lib/client/checkin/timeWindows"
import { computePhysiologicalDate } from "@/lib/nutrition/physiological-date"
import { estimateCaffeineMg, type DrinkType } from "@/lib/client/nutrition/drinks"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()

  return data?.id ?? null
}

const drinkTypeSchema = z.enum(["water", "espresso", "coffee", "lungo", "tea"])
const kindSchema = z.enum(["all", "water", "caffeine"])

const postSchema = z.object({
  amount_ml: z.number().positive().max(5000),
  drink_type: drinkTypeSchema.optional().default("water"),
  caffeine_mg: z.number().int().min(0).max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function getClientContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const clientId = await resolveClientId(user.id)
  if (!clientId) return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) }

  const db = service()
  const timezone = await resolveClientTimezone(db, clientId)

  return { db, clientId, timezone }
}

export async function GET(req: NextRequest) {
  const ctx = await getClientContext()
  if ("error" in ctx) return ctx.error

  const { db, clientId, timezone } = ctx
  const url = new URL(req.url)

  const rawKind = url.searchParams.get("kind") ?? "all"
  const kind = kindSchema.safeParse(rawKind).success ? (rawKind as z.infer<typeof kindSchema>) : "all"

  const date =
    url.searchParams.get("date")?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? url.searchParams.get("date")!
      : computePhysiologicalDate(new Date(), timezone)

  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)

  let query = db
    .from("client_water_logs")
    .select("id, amount_ml, caffeine_mg, drink_type, logged_at")
    .eq("client_id", clientId)
    .gte("logged_at", start.toISOString())
    .lte("logged_at", end.toISOString())
    .order("logged_at", { ascending: false })

  if (kind === "water") {
    query = query.or("drink_type.eq.water,caffeine_mg.eq.0,caffeine_mg.is.null")
  }

  if (kind === "caffeine") {
    query = query.gt("caffeine_mg", 0)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getClientContext()
  if ("error" in ctx) return ctx.error

  const { db, clientId } = ctx
  const body = postSchema.safeParse(await req.json())

  if (!body.success) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const { amount_ml, drink_type, date } = body.data
  const drinkType = drink_type as DrinkType
  const caffeineMg = body.data.caffeine_mg ?? estimateCaffeineMg(drinkType, amount_ml)

  const loggedAt = date
    ? new Date(`${date}T12:00:00.000Z`)
    : new Date()

  const { data, error } = await db
    .from("client_water_logs")
    .insert({
      client_id: clientId,
      amount_ml,
      drink_type: drinkType,
      caffeine_mg: caffeineMg,
      logged_at: loggedAt.toISOString(),
    })
    .select("id, amount_ml, caffeine_mg, drink_type, logged_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("components/client/QuickCaffeineModal.tsx")
s = p.read_text()

# Helper de sécurité : même si la route renvoie all, on ne garde que café/thé côté modal.
helper = '''
function isCaffeineLog(log: CaffeineLog): boolean {
  return Number(log.caffeine_mg ?? 0) > 0 || ["espresso", "coffee", "lungo", "tea"].includes(log.drink_type)
}
'''

if "function isCaffeineLog" not in s:
  marker = "function formatTime"
  idx = s.find(marker)
  if idx == -1:
    raise SystemExit("❌ function formatTime introuvable dans QuickCaffeineModal")
  s = s[:idx] + helper + "\n" + s[idx:]

# Refetch robuste.
s = s.replace(
  "const params = new URLSearchParams({ kind: 'caffeine' })",
  "const params = new URLSearchParams({ kind: 'caffeine' })"
)

s = s.replace(
  "if (!cancelled) setLogs((json?.data ?? []) as CaffeineLog[])",
  "if (!cancelled) setLogs(((json?.data ?? []) as CaffeineLog[]).filter(isCaffeineLog))"
)

# Bouton plus compact + wording Ajouter.
s = s.replace(
  'className="mt-4 h-14 w-full rounded-2xl font-barlow-condensed text-[16px] font-black uppercase tracking-[0.16em] active:scale-[0.98] transition-all disabled:opacity-50"',
  'className="mt-4 h-12 w-full rounded-xl font-barlow-condensed text-[13px] font-black uppercase tracking-[0.14em] active:scale-[0.98] transition-all disabled:opacity-50"'
)

s = s.replace(
  "{done ? 'Boisson loguée' : saving ? 'Enregistrement...' : `Loguer ${meta.logLabel}`}",
  "{done ? 'Ajouté' : saving ? 'Ajout...' : 'Ajouter'}"
)

p.write_text(s)
PY

echo "✅ API water sécurisée + bouton café/thé compact + libellé Ajouter."
echo ""
echo "Contrôle TypeScript :"
npx tsc --noEmit --pretty false
