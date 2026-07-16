#!/usr/bin/env bash
set -euo pipefail

REPORT="audit-cafe-the-$(date +%Y%m%d-%H%M%S).txt"

echo "🔎 Audit Café & Thé STRYVLAB"
echo "📄 Rapport: $REPORT"
echo ""

{
  echo "============================================================"
  echo "AUDIT CAFÉ & THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Infos repo"
  echo ""
  pwd
  echo ""
  git rev-parse --show-toplevel 2>/dev/null || true
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Recherche fichiers liés à café / thé / caféine"
  echo "============================================================"
  echo ""

  find . \
    -path "./node_modules" -prune -o \
    -path "./.next" -prune -o \
    -path "./.git" -prune -o \
    -path "./dist" -prune -o \
    -path "./build" -prune -o \
    -type f \( \
      -name "*.tsx" -o \
      -name "*.ts" -o \
      -name "*.jsx" -o \
      -name "*.js" -o \
      -name "*.json" \
    \) -print \
  | grep -Ei "(coffee|cafe|café|tea|thé|the|caffeine|caféine|theine|théine|espresso|lungo|boisson|drink|hydration|checkin|check-in|nutrition)" \
  | sort || true

  echo ""
  echo "============================================================"
  echo "### 3. Occurrences exactes dans le code"
  echo "============================================================"
  echo ""

  grep -RInE \
    "café|cafe|coffee|thé|the|tea|caffeine|caféine|theine|théine|espresso|lungo|mg/100ml|millilitres|ml|charge active|loguer café|loguer thé|Cafe|Tea|Coffee" \
    . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --include="*.json" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    || true

  echo ""
  echo "============================================================"
  echo "### 4. Composants UI potentiellement concernés"
  echo "============================================================"
  echo ""

  find . \
    -path "./node_modules" -prune -o \
    -path "./.next" -prune -o \
    -path "./.git" -prune -o \
    -type f \( -name "*.tsx" -o -name "*.ts" \) -print \
  | grep -Ei "(Quick|Log|Modal|Sheet|Drawer|Nutrition|Hydration|Checkin|CheckIn|Drink|Beverage|Caffeine|Coffee|Tea|Cafe|The|Client)" \
  | sort || true

  echo ""
  echo "============================================================"
  echo "### 5. Extraits autour des mots-clés principaux"
  echo "============================================================"
  echo ""

  FILES=$(grep -RIlE \
    "café|cafe|coffee|thé|tea|caffeine|caféine|espresso|lungo|charge active|loguer café|millilitres" \
    . \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.jsx" \
    --include="*.js" \
    --include="*.json" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    || true)

  for f in $FILES; do
    echo ""
    echo "------------------------------------------------------------"
    echo "FILE: $f"
    echo "------------------------------------------------------------"
    grep -nE "café|cafe|coffee|thé|tea|caffeine|caféine|espresso|lungo|charge active|loguer café|millilitres" "$f" || true
  done

  echo ""
  echo "============================================================"
  echo "### 6. Recherche des icônes utilisées"
  echo "============================================================"
  echo ""

  grep -RInE \
    "Coffee|Bean|Leaf|Cup|Mug|Icon|Lucide|lucide-react|svg|path|espresso|tea" \
    . \
    --include="*.tsx" \
    --include="*.ts" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    || true

  echo ""
  echo "============================================================"
  echo "### 7. APIs / routes liées au log nutrition, hydration, check-in"
  echo "============================================================"
  echo ""

  find ./app ./pages ./src ./lib ./components 2>/dev/null \
    -path "./node_modules" -prune -o \
    -path "./.next" -prune -o \
    -type f \( -name "route.ts" -o -name "*.ts" -o -name "*.tsx" \) -print \
  | grep -Ei "(nutrition|hydration|checkin|check-in|log|drink|caffeine|coffee|tea|cafe|the)" \
  | sort || true

  echo ""
  echo "============================================================"
  echo "### 8. Tables / types / schema potentiellement concernés"
  echo "============================================================"
  echo ""

  grep -RInE \
    "caffeine|cafe|coffee|tea|drink|beverage|hydration|nutrition_log|nutritionLog|checkin|check_in|Daily|Meal|water|ml" \
    . \
    --include="*.sql" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.json" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude-dir=dist \
    --exclude-dir=build \
    || true

  echo ""
  echo "============================================================"
  echo "FIN AUDIT"
  echo "============================================================"

} > "$REPORT"

echo "✅ Audit terminé."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "👉 Colle-moi le contenu avec :"
echo ""
echo "cat $REPORT"
