#!/usr/bin/env bash
set -euo pipefail

CAFFEINE="components/client/QuickCaffeineModal.tsx"
WATER="components/client/QuickWaterModal.tsx"
ACTIVITY="components/client/smart/FreeActivitySheet.tsx"

for f in "$CAFFEINE" "$WATER" "$ACTIVITY"; do
  if [ ! -f "$f" ]; then
    echo "❌ Fichier introuvable: $f"
    exit 1
  fi
  cp "$f" "$f.bak-unify-cta-$(date +%Y%m%d-%H%M%S)"
done

python3 - <<'PY'
from pathlib import Path
import re

CTA_CLASS = "mt-3 h-11 w-full rounded-xl font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] active:scale-[0.98] transition-all disabled:opacity-50"
CTA_STYLE = 'style={{ background: "#f2f2f2", color: "#080808" }}'

def replace_button_block(path: str, terms: list[str], label_expr: str = "Ajouter") -> None:
    p = Path(path)
    s = p.read_text()

    buttons = list(re.finditer(r"<button\b[\s\S]*?</button>", s))
    candidates = []

    for m in buttons:
        block = m.group(0)
        if any(term in block for term in terms):
            candidates.append(m)

    if not candidates:
        raise SystemExit(f"❌ CTA introuvable dans {path}. Termes cherchés: {terms}")

    target = candidates[-1]
    block = target.group(0)

    on_click = re.search(r"\s+onClick=\{[^}]+\}", block)
    disabled = re.search(r"\s+disabled=\{[^}]+\}", block)

    attrs = []
    if on_click:
        attrs.append(on_click.group(0).strip())
    if disabled:
        attrs.append(disabled.group(0).strip())

    attrs.append(f'className="{CTA_CLASS}"')
    attrs.append(CTA_STYLE)

    replacement = (
        "<button\n"
        + "\n".join(f"            {attr}" for attr in attrs)
        + "\n          >\n"
        + f"            {label_expr}\n"
        + "          </button>"
    )

    s = s[:target.start()] + replacement + s[target.end():]
    p.write_text(s)
    print(f"✅ CTA unifié dans {path}")

def ensure_caffeine_source_truth() -> None:
    p = Path("components/client/QuickCaffeineModal.tsx")
    s = p.read_text()

    # Labels masculin : un café / un thé
    s = s.replace("small:  { label: 'Petite'", "small:  { label: 'Petit'")
    s = s.replace("medium: { label: 'Moyenne'", "medium: { label: 'Moyen'")
    s = s.replace("large:  { label: 'Grande'", "large:  { label: 'Grand'")

    # CTA café : source de vérité compact, sans Loguer.
    pattern = re.compile(
        r"<button\s+[\s\S]*?onClick=\{logDrink\}[\s\S]*?</button>",
        re.MULTILINE
    )

    replacement = f'''<button
            onClick={{logDrink}}
            disabled={{saving}}
            className="{CTA_CLASS}"
            {CTA_STYLE}
          >
            {{saving ? 'Ajout...' : 'Ajouter'}}
          </button>'''

    s, count = pattern.subn(replacement, s, count=1)
    if count != 1:
        raise SystemExit("❌ CTA café/thé source de vérité non remplacé")

    p.write_text(s)
    print("✅ CTA café/thé confirmé comme source de vérité")

ensure_caffeine_source_truth()

# Hydratation : remplace le CTA qui logue l'eau, enlève goutte + quantité.
replace_button_block(
    "components/client/QuickWaterModal.tsx",
    terms=["LOGUER", "Loguer", "logWater", "amount_ml", "ml"],
    label_expr="{saving ? 'Ajout...' : 'Ajouter'}",
)

# Activité : remplace le CTA Enregistrer par Ajouter, même style.
replace_button_block(
    "components/client/smart/FreeActivitySheet.tsx",
    terms=["ENREGISTRER", "Enregistrer", "Enregistrement", "save", "handleSave"],
    label_expr="{saving ? 'Ajout...' : 'Ajouter'}",
)

PY

echo ""
echo "✅ Vérification des CTA :"
grep -nE "Ajouter|Loguer|LOGUER|ENREGISTRER|Enregistrer|h-11|h-12|h-14" \
  components/client/QuickCaffeineModal.tsx \
  components/client/QuickWaterModal.tsx \
  components/client/smart/FreeActivitySheet.tsx || true

echo ""
echo "✅ Contrôle ciblé TypeScript :"
npx tsc --noEmit --pretty false 2>&1 | grep -E "QuickCaffeineModal|QuickWaterModal|FreeActivitySheet|QuickLogSheet|app/api/client/water/route" || true
