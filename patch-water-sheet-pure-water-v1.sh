#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickWaterModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-pure-water-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("components/client/QuickWaterModal.tsx")
s = p.read_text()

# 1) Le sheet Hydratation doit demander l'eau pure, jamais all.
s = s.replace("new URLSearchParams({ kind: 'all' })", "new URLSearchParams({ kind: 'water' })")
s = s.replace('new URLSearchParams({ kind: "all" })', 'new URLSearchParams({ kind: "water" })')

# 2) Titre propre.
s = s.replace("HYDRATATION RAPIDE", "HYDRATATION")
s = s.replace("Hydratation rapide", "Hydratation")
s = s.replace("hydratation rapide", "hydratation")

# 3) Ajoute un filtre de sécurité UI si absent.
if "function isPureWaterLog" not in s:
    helper = '''
const WATER_SHEET_EXCLUDED_TYPES = new Set(['espresso', 'coffee', 'lungo', 'tea'])

function isPureWaterLog(log: WaterLog): boolean {
  const drinkType = String(log.drink_type ?? 'water')
  const caffeineMg = Number(log.caffeine_mg ?? 0)

  return !WATER_SHEET_EXCLUDED_TYPES.has(drinkType) && caffeineMg <= 0
}

'''
    if "function LogIcon" in s:
        s = s.replace("function LogIcon", helper + "function LogIcon", 1)
    elif "export default function QuickWaterModal" in s:
        s = s.replace("export default function QuickWaterModal", helper + "export default function QuickWaterModal", 1)
    else:
        raise SystemExit("❌ Impossible d'insérer isPureWaterLog dans QuickWaterModal")

# 4) Filtre les lignes reçues avant affichage.
s = s.replace("setLogs(rows)", "setLogs(rows.filter(isPureWaterLog))")

s = s.replace(
    "setLogs(((json?.data ?? json?.logs ?? []) as WaterLog[]))",
    "setLogs(((json?.data ?? json?.logs ?? []) as WaterLog[]).filter(isPureWaterLog))"
)

# Cas plus compact éventuel.
s = re.sub(
    r"setLogs\(\s*\(\(json\?\.data \?\? json\?\.logs \?\? \[\]\) as WaterLog\[\]\)\s*\)",
    "setLogs(((json?.data ?? json?.logs ?? []) as WaterLog[]).filter(isPureWaterLog))",
    s,
)

p.write_text(s)
print("✅ QuickWaterModal sécurisé : eau pure uniquement.")
PY

echo ""
echo "✅ Vérification :"
grep -nE "kind: 'water'|kind: 'all'|isPureWaterLog|WATER_SHEET_EXCLUDED_TYPES|setLogs\\(rows|Hydratation|Café|lungo|coffee|tea" "$FILE" || true

echo ""
echo "✅ TypeScript ciblé :"
npx tsc --noEmit --pretty false 2>&1 | grep -E "QuickWaterModal|app/api/client/water/route" || true
