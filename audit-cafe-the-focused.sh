#!/usr/bin/env bash
set -euo pipefail

REPORT="audit-cafe-the-focused-$(date +%Y%m%d-%H%M%S).txt"

echo "🔎 Audit ciblé Café/Thé"
echo "📄 Rapport: $REPORT"

{
  echo "============================================================"
  echo "AUDIT CIBLÉ CAFÉ / THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo"
  pwd
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Fichiers avec client_water_logs / caffeine_mg / amount_ml"
  echo "============================================================"
  git grep -nE "client_water_logs|caffeine_mg|amount_ml" -- \
    "*.ts" "*.tsx" "*.js" "*.jsx" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 3. Fichiers UI hydration / quick logger / modal / sheet"
  echo "============================================================"
  find . \
    -path "./node_modules" -prune -o \
    -path "./.next" -prune -o \
    -path "./.git" -prune -o \
    -type f \( -name "*.tsx" -o -name "*.ts" \) -print \
  | grep -Ei "(hydration|water|drink|beverage|quick|logger|log|modal|sheet|drawer|radial|nutrition)" \
  | sort
  echo ""

  echo "============================================================"
  echo "### 4. Occurrences UI visibles: café, thé, espresso, lungo, loguer"
  echo "============================================================"
  git grep -nEi "café|cafe|coffee|thé|tea|espresso|lungo|loguer|charge active|mg/100ml|millilitres|ml enregistré|hydratation rapide|quick hydration" -- \
    "*.tsx" "*.ts" "*.js" "*.jsx" "*.json" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 5. Imports icônes potentiellement concernés"
  echo "============================================================"
  git grep -nE "lucide-react|Coffee|Cup|GlassWater|Leaf|Bean|Droplets|Mug|Icon" -- \
    "*.tsx" "*.ts" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 6. Dump complet des fichiers candidats"
  echo "============================================================"

  CANDIDATES=$(git grep -lEi "café|cafe|coffee|thé|tea|espresso|lungo|caffeine_mg|client_water_logs|hydratation rapide|quick hydration|water.log|amount_ml" -- \
    "*.tsx" "*.ts" "*.js" "*.jsx" 2>/dev/null || true)

  for f in $CANDIDATES; do
    echo ""
    echo "------------------------------------------------------------"
    echo "FILE: $f"
    echo "------------------------------------------------------------"
    nl -ba "$f" | sed -n '1,260p'
  done

  echo ""
  echo "============================================================"
  echo "FIN AUDIT CIBLÉ"
  echo "============================================================"

} > "$REPORT"

echo "✅ Audit ciblé terminé."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "👉 Colle-moi le contenu avec :"
echo "cat $REPORT"
