#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-coffee-bean-v3-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("components/client/QuickCaffeineModal.tsx")
s = p.read_text()

coffee_bean_fn = r'''
function CoffeeBean({ active = true, color = '#c08457', size = 17 }: { active?: boolean; color?: string; size?: number }) {
  const stroke = active ? color : 'rgba(255,255,255,0.30)'
  const fill = active ? color : 'transparent'
  const groove = active ? '#0d0d0d' : 'rgba(255,255,255,0.30)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d="M17.8 3.6c3.1 2.1 3.5 7.5.8 12.1-2.7 4.6-7.4 6.6-10.5 4.5-3.1-2.1-3.5-7.5-.8-12.1 2.7-4.6 7.4-6.6 10.5-4.5Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.75"
      />
      <path
        d="M14.8 4.7c-2.2 2.4-2.1 5-.8 7.4 1.3 2.5 1.2 5.1-1.2 7.4"
        fill="none"
        stroke={groove}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

'''

# 1) Si CoffeeBean existe déjà, on le remplace. Sinon on l’ajoute avant export default.
if "function CoffeeBean" in s:
    s = re.sub(
        r"function CoffeeBean\([\s\S]*?\n\}\n\nexport default function",
        coffee_bean_fn + "export default function",
        s,
        count=1,
    )
else:
    marker = "export default function QuickCaffeineModal"
    if marker not in s:
        raise SystemExit("❌ export default QuickCaffeineModal introuvable")
    s = s.replace(marker, coffee_bean_fn + marker, 1)

# 2) Remplacer les icônes café Phosphor dans les petits badges/logs par le grain.
s = re.sub(
    r"<Coffee size=\{15\} style=\{\{ color: logMeta\.accent \}\} />",
    "<CoffeeBean active color={logMeta.accent} size={16} />",
    s,
)

s = re.sub(
    r"<Coffee size=\{15\} style=\{\{ color: active \? item\.accent : 'rgba\(255,255,255,0\.32\)' \}\} />",
    "<CoffeeBean active={active} color={item.accent} size={16} />",
    s,
)

s = re.sub(
    r"<Coffee size=\{15\} style=\{\{ color: active \? item\.accent : \"rgba\(255,255,255,0\.32\)\" \}\} />",
    "<CoffeeBean active={active} color={item.accent} size={16} />",
    s,
)

# 3) Sécurité : afficher où CoffeeBean est maintenant utilisé.
p.write_text(s)

print("✅ CoffeeBean ajouté/remplacé.")
print("Occurrences CoffeeBean:", s.count("CoffeeBean"))
PY

npx tsc --noEmit --pretty false
