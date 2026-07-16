#!/usr/bin/env bash
set -euo pipefail

REPORT="nutrition-page-source-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "NUTRITION PAGE SOURCE"
  echo "============================================================"
  echo ""

  echo "### 1. app/client/nutrition/page.tsx"
  if [ -f "app/client/nutrition/page.tsx" ]; then
    nl -ba "app/client/nutrition/page.tsx" | sed -n '1,1200p'
  else
    echo "introuvable"
  fi

  echo ""
  echo "### 2. Imports de app/client/nutrition/page.tsx"
  if [ -f "app/client/nutrition/page.tsx" ]; then
    grep -nE "^import .* from ['\"]" "app/client/nutrition/page.tsx" || true
  fi

  echo ""
  echo "### 3. Fichiers importés probables"
  for f in \
    components/client/smart/SmartNutritionWidget.tsx \
    components/client/smart/SmartNutritionHero.tsx \
    components/client/smart/SmartNutritionQuickActions.tsx \
    components/client/nutrition/NutritionClientPage.tsx \
    components/client/nutrition/HydrationQuickLog.tsx \
    components/client/nutrition/WaterQuickLog.tsx \
    components/client/nutrition/CaffeineQuickLog.tsx \
    components/client/nutrition/DrinkQuickLog.tsx \
    components/client/nutrition/HydrationSheet.tsx \
    components/client/nutrition/CaffeineSheet.tsx \
    components/client/nutrition/DrinkSheet.tsx
  do
    if [ -f "$f" ]; then
      echo ""
      echo "------------------------------------------------------------"
      echo "FILE: $f"
      echo "------------------------------------------------------------"
      nl -ba "$f" | sed -n '1,1200p'
    fi
  done

  echo ""
  echo "### 4. Recherche source exacte hors .next"
  grep -RInE "mg cumulés|Espresso|Lungo|Charge active|LOGUER CAFÉ|LOGUER THÉ|DRINK_PRESETS|estimateCaffeineMg|client_water_logs|caffeine_mg|amount_ml|/api/client/nutrition/hydration" app components lib \
    --include="*.tsx" \
    --include="*.ts" \
    2>/dev/null || true

  echo ""
  echo "============================================================"
  echo "FIN"
  echo "============================================================"
} > "$REPORT"

echo "✅ Source nutrition extraite."
echo "📄 Fichier généré: $REPORT"
echo "Colle uniquement :"
echo "cat $REPORT"
