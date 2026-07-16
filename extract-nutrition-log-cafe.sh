#!/usr/bin/env bash
set -euo pipefail

REPORT="nutrition-log-cafe-source-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "NUTRITION LOG CAFÉ / THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Fichier principal NutritionLogContent"
  echo "============================================================"
  if [ -f "app/client/nutrition/log/NutritionLogContent.tsx" ]; then
    nl -ba "app/client/nutrition/log/NutritionLogContent.tsx" | sed -n '1,1400p'
  else
    echo "Fichier introuvable: app/client/nutrition/log/NutritionLogContent.tsx"
  fi

  echo ""
  echo "### 2. Occurrences café/thé/eau/caféine dans le dossier log"
  echo "============================================================"
  grep -RInE "DRINK_PRESETS|estimateCaffeineMg|inferDrinkTypeFromFoodItem|client_water_logs|caffeine_mg|amount_ml|espresso|lungo|coffee|café|Café|tea|thé|Thé|water|hydration|Loguer|mg/100ml|millilitres|Charge active" \
    app/client/nutrition/log \
    --include="*.tsx" \
    --include="*.ts" \
    2>/dev/null || true

  echo ""
  echo "### 3. Fichiers locaux du dossier log"
  echo "============================================================"
  find app/client/nutrition/log -maxdepth 3 -type f \( -name "*.tsx" -o -name "*.ts" \) -print | sort

  echo ""
  echo "### 4. Dumps des fichiers locaux suspects"
  echo "============================================================"
  CANDIDATES=$(grep -RIlE "DRINK_PRESETS|estimateCaffeineMg|inferDrinkTypeFromFoodItem|client_water_logs|caffeine_mg|amount_ml|espresso|lungo|coffee|café|Café|tea|thé|Thé|water|hydration|Loguer|mg/100ml|millilitres|Charge active" \
    app/client/nutrition/log \
    --include="*.tsx" \
    --include="*.ts" \
    2>/dev/null || true)

  for f in $CANDIDATES; do
    [ -f "$f" ] || continue
    echo ""
    echo "------------------------------------------------------------"
    echo "FILE: $f"
    echo "------------------------------------------------------------"
    nl -ba "$f" | sed -n '1,1200p'
  done

  echo ""
  echo "============================================================"
  echo "FIN NUTRITION LOG CAFÉ / THÉ"
  echo "============================================================"
} > "$REPORT"

echo "✅ Extraction terminée."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle uniquement :"
echo "cat $REPORT"
