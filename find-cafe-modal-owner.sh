#!/usr/bin/env bash
set -euo pipefail

REPORT="cafe-modal-owner-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "FIND CAFÉ MODAL OWNER - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo"
  pwd
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Recherche exacte textes UI du modal"
  echo "============================================================"

  grep -RInE "CAFÉ & THÉ|CAFE & THE|Café & Thé|Cafe & The|Charge active|LOGUER CAFÉ|LOGUER THÉ|Loguer café|Loguer thé|mg/100ml|millilitres|Espresso|Lungo|allongé|concentré|infusé" . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=tests \
    --exclude-dir=coverage \
    --exclude-dir=dist \
    --exclude-dir=build \
    2>/dev/null || true

  echo ""
  echo "============================================================"
  echo "### 3. Recherche eau / caffeine / quick log hors tests"
  echo "============================================================"

  grep -RInE "client_water_logs|caffeine_mg|amount_ml|estimateCaffeineMg|DRINK_PRESETS|inferDrinkTypeFromFoodItem|Hydratation rapide|Quick hydration|water.log|water.logged|quick.*water|quick.*hydration|hydrate|drink" . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=tests \
    --exclude-dir=coverage \
    --exclude-dir=dist \
    --exclude-dir=build \
    2>/dev/null || true

  echo ""
  echo "============================================================"
  echo "### 4. Pages client nutrition candidates"
  echo "============================================================"

  for f in \
    app/client/nutrition/page.tsx \
    app/client/nutrition/NutritionClientPage.tsx \
    app/client/page.tsx \
    app/client/home/page.tsx \
    app/client/dashboard/page.tsx
  do
    if [ -f "$f" ]; then
      echo ""
      echo "------------------------------------------------------------"
      echo "FILE: $f"
      echo "------------------------------------------------------------"
      nl -ba "$f" | sed -n '1,900p'
    fi
  done

  echo ""
  echo "============================================================"
  echo "### 5. Components smart / nutrition / hydration suspects"
  echo "============================================================"

  CANDIDATES=$(find components app lib \
    -path "*/node_modules" -prune -o \
    -path "*/tests" -prune -o \
    -type f \( -name "*.tsx" -o -name "*.ts" \) -print 2>/dev/null \
    | grep -Ei "water|hydration|drink|caffeine|coffee|cafe|tea|nutrition|smart|quick|radial|dock|sheet|modal|drawer" \
    | sort)

  echo "$CANDIDATES"
  echo ""

  for f in $CANDIDATES; do
    [ -f "$f" ] || continue
    if grep -qiE "client_water_logs|caffeine_mg|amount_ml|estimateCaffeineMg|DRINK_PRESETS|Hydratation rapide|Quick hydration|CAFÉ|Café|Espresso|Lungo|Charge active|Loguer|water.log|water.logged" "$f"; then
      echo ""
      echo "------------------------------------------------------------"
      echo "CANDIDATE: $f"
      echo "------------------------------------------------------------"
      nl -ba "$f" | sed -n '1,1200p'
    fi
  done

  echo ""
  echo "============================================================"
  echo "### 6. Recherche runtime .next exacte"
  echo "============================================================"

  if [ -d ".next" ]; then
    grep -RInE "CAFÉ & THÉ|Café & Thé|Charge active|LOGUER CAFÉ|LOGUER THÉ|mg/100ml|Espresso|Lungo|client_water_logs|caffeine_mg|estimateCaffeineMg|DRINK_PRESETS" .next \
      --include="*.js" \
      --include="*.map" \
      2>/dev/null | head -n 500 || true
  else
    echo ".next absent"
  fi

  echo ""
  echo "============================================================"
  echo "FIN FIND CAFÉ MODAL OWNER"
  echo "============================================================"
} > "$REPORT"

echo "✅ Recherche terminée."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle uniquement :"
echo "cat $REPORT"
