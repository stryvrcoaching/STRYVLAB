#!/usr/bin/env bash
set -euo pipefail

REPORT="audit-cafe-runtime-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "AUDIT RUNTIME CAFÉ / THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo / branche / statut"
  pwd
  git rev-parse --show-toplevel 2>/dev/null || true
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Recherche source SANS tests"
  echo "============================================================"

  grep -RInE "Espresso|Lungo|Café|café|Thé|thé|coffee|tea|caffeine|caféine|Charge active|mg/100ml|millilitres|Loguer café|Loguer thé|estimateCaffeineMg|client_water_logs|caffeine_mg|amount_ml" . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=tests \
    --exclude-dir=coverage \
    || true

  echo ""
  echo "============================================================"
  echo "### 3. Fichiers source candidats SANS tests"
  echo "============================================================"

  find . \
    -path "./node_modules" -prune -o \
    -path "./.git" -prune -o \
    -path "./tests" -prune -o \
    -path "./coverage" -prune -o \
    -path "./dist" -prune -o \
    -path "./build" -prune -o \
    -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) -print \
  | grep -Ei "water|hydration|drink|beverage|caffeine|coffee|cafe|tea|quick|logger|modal|sheet|drawer|radial|smart|nutrition|client" \
  | sort || true

  echo ""
  echo "============================================================"
  echo "### 4. Dump des vrais candidats source"
  echo "============================================================"

  CANDIDATES=$(grep -RIlE "Espresso|Lungo|Café|café|Thé|thé|coffee|tea|caffeine|caféine|Charge active|mg/100ml|millilitres|Loguer café|Loguer thé|estimateCaffeineMg|client_water_logs|caffeine_mg|amount_ml" . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=.next \
    --exclude-dir=tests \
    --exclude-dir=coverage \
    --exclude-dir=dist \
    --exclude-dir=build \
    || true)

  echo "$CANDIDATES"
  echo ""

  for f in $CANDIDATES; do
    [ -f "$f" ] || continue
    echo ""
    echo "------------------------------------------------------------"
    echo "FILE: $f"
    echo "------------------------------------------------------------"
    nl -ba "$f" | sed -n '1,360p'
  done

  echo ""
  echo "============================================================"
  echo "### 5. Recherche dans .next / sourcemaps si build présent"
  echo "============================================================"

  if [ -d ".next" ]; then
    grep -RInE "Espresso|Lungo|Café|café|Thé|thé|Charge active|mg/100ml|estimateCaffeineMg|client_water_logs|caffeine_mg" .next \
      --include="*.js" \
      --include="*.map" \
      2>/dev/null \
      | head -n 300 || true
  else
    echo ".next absent"
  fi

  echo ""
  echo "============================================================"
  echo "### 6. lib drinks exacte"
  echo "============================================================"

  if [ -f "lib/client/nutrition/drinks.ts" ]; then
    nl -ba "lib/client/nutrition/drinks.ts" | sed -n '1,260p'
  else
    echo "lib/client/nutrition/drinks.ts introuvable"
    find . -path "./node_modules" -prune -o -path "./.git" -prune -o -name "drinks.ts" -print
  fi

  echo ""
  echo "============================================================"
  echo "FIN AUDIT RUNTIME"
  echo "============================================================"

} > "$REPORT"

echo "✅ Audit runtime terminé."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle uniquement :"
echo "cat $REPORT"
