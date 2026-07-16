#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-cta-h11-labels-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("components/client/QuickCaffeineModal.tsx")
s = p.read_text()

# 1) Tailles au masculin : un café / un thé
s = s.replace("small:  { label: 'Petite'", "small:  { label: 'Petit'")
s = s.replace("medium: { label: 'Moyenne'", "medium: { label: 'Moyen'")
s = s.replace("large:  { label: 'Grande'", "large:  { label: 'Grand'")

# 2) CTA plus compact : h-11 au lieu de h-12/h-14
s = re.sub(
    r'className="mt-4 h-(?:12|14) w-full rounded-xl font-barlow-condensed text-\[\d+px\] font-black uppercase tracking-\[[^\]]+\] active:scale-\[0\.98\] transition-all disabled:opacity-50"',
    'className="mt-3 h-11 w-full rounded-xl font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] active:scale-[0.98] transition-all disabled:opacity-50"',
    s,
)

# 3) CTA simple : Ajouter
s = re.sub(
    r"\{done \? 'Ajouté' : saving \? 'Ajout\.\.\.' : 'Ajouter'\}",
    "{saving ? 'Ajout...' : 'Ajouter'}",
    s,
)

s = re.sub(
    r"\{done \? 'Boisson loguée' : saving \? 'Enregistrement\.\.\.' : `Loguer \$\{meta\.logLabel\}`\}",
    "{saving ? 'Ajout...' : 'Ajouter'}",
    s,
)

s = re.sub(
    r"\{done \? 'Boisson loguée' : saving \? 'Enregistrement\.\.\.' : 'Ajouter'\}",
    "{saving ? 'Ajout...' : 'Ajouter'}",
    s,
)

p.write_text(s)

print("✅ CTA passé en h-11 + libellé Ajouter.")
print("✅ Tailles corrigées : Petit / Moyen / Grand.")
PY

grep -nE "Petit|Moyen|Grand|h-11|Ajouter|Loguer" "$FILE" || true
