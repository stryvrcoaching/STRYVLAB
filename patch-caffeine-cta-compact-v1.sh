#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-cta-compact-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("components/client/QuickCaffeineModal.tsx")
s = p.read_text()

pattern = re.compile(
    r'''<button\s+
\s*onClick=\{logDrink\}
\s*disabled=\{saving\}
\s*className="[^"]*"
\s*style=\{
\s*done
\s*\? \{ background: 'rgba\(255,255,255,0\.08\)', color: 'rgba\(255,255,255,0\.55\)' \}
\s*: \{ background: '#f2f2f2', color: '#080808' \}
\s*\}
\s*>\s*
\s*\{done \? '[^']*' : saving \? '[^']*' : `?[^}`\n]*`?\}
\s*</button>''',
    re.MULTILINE
)

replacement = '''<button
            onClick={logDrink}
            disabled={saving}
            className="mt-3 h-12 w-full rounded-xl bg-[#f2f2f2] font-barlow-condensed text-[13px] font-black uppercase tracking-[0.14em] text-[#080808] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {done ? 'Ajouté' : saving ? 'Ajout...' : 'Ajouter'}
          </button>'''

new_s, count = pattern.subn(replacement, s)

if count != 1:
    raise SystemExit(f"❌ CTA café non remplacé. Occurrences trouvées: {count}")

p.write_text(new_s)
print("✅ CTA café/thé compact remplacé.")
PY

npx tsc --noEmit --pretty false
