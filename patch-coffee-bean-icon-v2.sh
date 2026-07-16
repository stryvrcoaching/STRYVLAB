#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-coffee-bean-v2-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("components/client/QuickCaffeineModal.tsx")
s = p.read_text()

pattern = re.compile(
r'''function CoffeeBean\(\{ active, color \}: \{ active: boolean; color: string \}\) \{
  return \(
    <svg[\s\S]*?
    </svg>
  \)
\}
''',
re.MULTILINE
)

replacement = '''function CoffeeBean({ active, color }: { active: boolean; color: string }) {
  const stroke = active ? color : 'rgba(255,255,255,0.26)'
  const fill = active ? color : 'transparent'
  const groove = active ? '#0d0d0d' : 'rgba(255,255,255,0.26)'

  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
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

new_s, count = pattern.subn(replacement, s)

if count != 1:
  raise SystemExit(f"❌ Fonction CoffeeBean non remplacée. Occurrences: {count}")

p.write_text(new_s)
print("✅ CoffeeBean remplacé par un vrai grain style outline/silhouette.")
PY

npx tsc --noEmit --pretty false
