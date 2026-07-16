#!/usr/bin/env bash
set -euo pipefail

REPORT="cafe-modal-source-final-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "CAFÉ MODAL SOURCE FINAL - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo"
  pwd
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Source maps / createProxy paths dans page nutrition"
  echo "============================================================"
  if [ -f ".next/server/app/client/nutrition/page.js" ]; then
    grep -oE "/Users/user/Desktop/STRYVLAB/[^\"'\\\`]+" ".next/server/app/client/nutrition/page.js" | sort -u || true
  else
    echo ".next/server/app/client/nutrition/page.js introuvable"
  fi

  echo ""
  echo "============================================================"
  echo "### 3. Recherche exacte du JSX café dans source + build"
  echo "============================================================"

  for pattern in \
    "mg cumulés" \
    "espresso\",\"coffee\",\"lungo\",\"tea" \
    "espresso', 'coffee', 'lungo', 'tea" \
    "espresso\",\"coffee\",\"lungo\",\"tea" \
    "DRINK_PRESETS" \
    "DrinkIcon" \
    "Caffeine" \
    "Hydration" \
    "client_water_logs" \
    "caffeine_mg" \
    "amount_ml" \
    "LOGUER" \
    "Charge active" \
    "CAFÉ & THÉ"
  do
    echo ""
    echo "----- PATTERN: $pattern -----"
    grep -RInF "$pattern" . \
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
  done

  echo ""
  echo "============================================================"
  echo "### 4. Fichiers candidats client nutrition/smart avec hydration/caffeine"
  echo "============================================================"

  CANDIDATES=$(find app components lib \
    -path "*/node_modules" -prune -o \
    -path "*/tests" -prune -o \
    -type f \( -name "*.tsx" -o -name "*.ts" \) -print 2>/dev/null \
    | grep -Ei "nutrition|hydration|water|drink|caffeine|coffee|cafe|tea|smart|widget|sheet|modal|drawer|quick" \
    | sort)

  echo "$CANDIDATES"
  echo ""

  echo "============================================================"
  echo "### 5. Dump des candidats qui contiennent la logique eau/caféine"
  echo "============================================================"

  for f in $CANDIDATES; do
    [ -f "$f" ] || continue
    if grep -qiE "client_water_logs|caffeine_mg|amount_ml|DRINK_PRESETS|estimateCaffeineMg|DrinkIcon|mg cumul|espresso|lungo|CAFÉ|Café|Thé|Charge active|LOGUER|hydration/route|/api/client/nutrition/hydration" "$f"; then
      echo ""
      echo "------------------------------------------------------------"
      echo "FILE: $f"
      echo "------------------------------------------------------------"
      nl -ba "$f" | sed -n '1,1400p'
    fi
  done

  echo ""
  echo "============================================================"
  echo "### 6. Route hydration source"
  echo "============================================================"
  if [ -f "app/api/client/nutrition/hydration/route.ts" ]; then
    nl -ba "app/api/client/nutrition/hydration/route.ts" | sed -n '1,260p'
  else
    echo "Fichier introuvable: app/api/client/nutrition/hydration/route.ts"
  fi

  echo ""
  echo "============================================================"
  echo "FIN CAFÉ MODAL SOURCE FINAL"
  echo "============================================================"
} > "$REPORT"

echo "✅ Extraction finale terminée."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle uniquement :"
echo "cat $REPORT"
