#!/usr/bin/env bash
set -euo pipefail

FILE="app/api/client/water/route.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-water-compat-v2-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("app/api/client/water/route.ts")
s = p.read_text()

start_marker = "export async function GET(req: NextRequest) {"
end_marker = "export async function POST"

start = s.find(start_marker)
end = s.find(end_marker)

if start == -1:
    raise SystemExit("❌ GET introuvable dans app/api/client/water/route.ts")

if end == -1 or end <= start:
    raise SystemExit("❌ POST introuvable après GET dans app/api/client/water/route.ts")

new_get = '''export async function GET(req: NextRequest) {
  const ctx = await getClientContext()
  if ("error" in ctx) return ctx.error

  const { db, clientId, timezone } = ctx
  const url = new URL(req.url)

  const rawKind = url.searchParams.get("kind") ?? "all"
  const kind = kindSchema.safeParse(rawKind).success ? (rawKind as z.infer<typeof kindSchema>) : "all"

  const requestedDate = url.searchParams.get("date")
  const date =
    requestedDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(requestedDate)
      ? requestedDate
      : computePhysiologicalDate(new Date(), timezone)

  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)

  const { data, error } = await db
    .from("client_water_logs")
    .select("id, amount_ml, caffeine_mg, drink_type, logged_at")
    .eq("client_id", clientId)
    .gte("logged_at", start.toISOString())
    .lte("logged_at", end.toISOString())
    .order("logged_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    drink_type: row.drink_type ?? "water",
    caffeine_mg: Number(row.caffeine_mg ?? 0),
    amount_ml: Number(row.amount_ml ?? 0),
  }))

  const caffeineTypes = new Set(["espresso", "coffee", "lungo", "tea"])

  const filteredRows =
    kind === "water"
      ? rows.filter((row) => !caffeineTypes.has(String(row.drink_type)) && Number(row.caffeine_mg ?? 0) <= 0)
      : kind === "caffeine"
        ? rows.filter((row) => caffeineTypes.has(String(row.drink_type)) || Number(row.caffeine_mg ?? 0) > 0)
        : rows

  const totalMl = filteredRows.reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0)
  const totalCaffeineMg = filteredRows.reduce((sum, row) => sum + Number(row.caffeine_mg ?? 0), 0)

  return NextResponse.json({
    ok: true,

    // Nouveau contrat utilisé par café/thé
    data: filteredRows,

    // Ancien contrat probable utilisé par hydratation rapide
    logs: filteredRows,

    // Totaux compatibles
    total_ml: totalMl,
    totalMl,
    total_caffeine_mg: totalCaffeineMg,
    totalCaffeineMg,
  })
}

'''

s = s[:start] + new_get + s[end:]
p.write_text(s)

print("✅ GET /api/client/water remplacé sans regex.")
PY

echo ""
echo "Contrôle ciblé :"
npx tsc --noEmit --pretty false 2>&1 | grep -E "app/api/client/water/route|QuickWaterModal|QuickCaffeineModal" || true
