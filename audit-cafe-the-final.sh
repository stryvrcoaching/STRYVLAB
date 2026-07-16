#!/usr/bin/env bash
set -euo pipefail

REPORT="audit-cafe-the-final-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "AUDIT FINAL CAFÉ / THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo"
  pwd
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Fichiers non trackés/modifiés utiles"
  echo "============================================================"
  git status --short | grep -Ei "coffee|cafe|café|tea|thé|drink|water|hydration|nutrition|log|quick|modal|sheet|drawer|client" || true
  echo ""

  echo "============================================================"
  echo "### 3. Recherche brute dans TOUS les fichiers source"
  echo "============================================================"

  SEARCH_FILES=$(find . \
    -path "./node_modules" -prune -o \
    -path "./.next" -prune -o \
    -path "./.git" -prune -o \
    -path "./dist" -prune -o \
    -path "./build" -prune -o \
    -type f \( \
      -name "*.tsx" -o \
      -name "*.ts" -o \
      -name "*.jsx" -o \
      -name "*.js" \
    \) -print)

  echo "$SEARCH_FILES" | grep -Ei "drink|water|hydration|caffeine|coffee|cafe|tea|nutrition|quick|logger|modal|sheet|drawer|client" | sort || true
  echo ""

  echo "============================================================"
  echo "### 4. Occurrences clés exactes"
  echo "============================================================"

  for pattern in \
    "estimateCaffeineMg" \
    "inferDrinkTypeFromFoodItem" \
    "DRINK" \
    "drinkType" \
    "caffeine_mg" \
    "client_water_logs" \
    "espresso" \
    "lungo" \
    "Café" \
    "café" \
    "coffee" \
    "Thé" \
    "thé" \
    "tea" \
    "Charge active" \
    "charge active" \
    "mg/100ml" \
    "millilitres" \
    "Loguer" \
    "Hydratation rapide" \
    "Quick hydration"
  do
    echo ""
    echo "----- PATTERN: $pattern -----"
    grep -RInF "$pattern" . \
      --include="*.tsx" \
      --include="*.ts" \
      --include="*.jsx" \
      --include="*.js" \
      --exclude-dir=node_modules \
      --exclude-dir=.next \
      --exclude-dir=.git \
      --exclude-dir=dist \
      --exclude-dir=build \
      || true
  done

  echo ""
  echo "============================================================"
  echo "### 5. Fichiers avec estimateCaffeineMg / drinks lib"
  echo "============================================================"

  DRINK_FILES=$(grep -RIlE "estimateCaffeineMg|inferDrinkTypeFromFoodItem|client_water_logs|caffeine_mg|espresso|lungo|Charge active|mg/100ml" . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    || true)

  echo "$DRINK_FILES"
  echo ""

  for f in $DRINK_FILES; do
    [ -f "$f" ] || continue
    echo ""
    echo "------------------------------------------------------------"
    echo "FILE: $f"
    echo "------------------------------------------------------------"
    nl -ba "$f" | sed -n '1,320p'
  done

  echo ""
  echo "============================================================"
  echo "### 6. Fichiers UI hydratation/log rapide probables"
  echo "============================================================"

  UI_FILES=$(find . \
    -path "./node_modules" -prune -o \
    -path "./.next" -prune -o \
    -path "./.git" -prune -o \
    -path "./dist" -prune -o \
    -path "./build" -prune -o \
    -type f \( -name "*.tsx" -o -name "*.ts" \) -print \
    | grep -Ei "water|hydration|drink|beverage|caffeine|coffee|tea|quick|logger|log|modal|sheet|drawer|radial|smart|nutrition" \
    | sort)

  echo "$UI_FILES"
  echo ""

  for f in $UI_FILES; do
    [ -f "$f" ] || continue
    if grep -qiE "amount_ml|caffeine_mg|client_water_logs|estimateCaffeineMg|espresso|lungo|café|coffee|thé|tea|water.log|Hydratation rapide|Quick hydration" "$f"; then
      echo ""
      echo "------------------------------------------------------------"
      echo "UI CANDIDATE: $f"
      echo "------------------------------------------------------------"
      nl -ba "$f" | sed -n '1,260p'
    fi
  done

  echo ""
  echo "============================================================"
  echo "FIN AUDIT FINAL"
  echo "============================================================"

} > "$REPORT"

echo "✅ Audit final terminé."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle-moi uniquement :"
echo "cat $REPORT"
