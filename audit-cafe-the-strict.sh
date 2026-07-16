#!/usr/bin/env bash
set -euo pipefail

REPORT="audit-cafe-the-strict-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "AUDIT STRICT CAFÉ / THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo"
  pwd
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. Inserts/updates client_water_logs"
  echo "============================================================"
  git grep -n "client_water_logs" -- "*.ts" "*.tsx" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 3. caffeine_mg / amount_ml dans UI et routes"
  echo "============================================================"
  git grep -nE "caffeine_mg|amount_ml|caffeine_daily_mg" -- \
    "app/**/*.ts" "app/**/*.tsx" "components/**/*.ts" "components/**/*.tsx" "lib/**/*.ts" "lib/**/*.tsx" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 4. Textes visibles café/thé exacts"
  echo "============================================================"
  git grep -nEi "café|coffee|espresso|lungo|caféine|caffeine|thé|tea|matcha|infusion|loguer café|loguer thé|charge active|mg/100ml" -- \
    "app/**/*.tsx" "components/**/*.tsx" "lib/i18n/**/*.ts" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 5. Hydratation rapide / water logger"
  echo "============================================================"
  git grep -nEi "Hydratation rapide|Quick hydration|water.title|water.log|water.logged|client_water_logs|amount_ml" -- \
    "app/**/*.tsx" "components/**/*.tsx" "lib/**/*.ts" "lib/**/*.tsx" 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 6. Fichiers candidats exacts"
  echo "============================================================"

  CANDIDATES=$(
    {
      git grep -l "client_water_logs" -- "*.ts" "*.tsx" 2>/dev/null || true
      git grep -l "caffeine_mg" -- "*.ts" "*.tsx" 2>/dev/null || true
      git grep -lEi "espresso|lungo|caféine|caffeine|coffee|matcha|loguer café|charge active|mg/100ml" -- "*.ts" "*.tsx" 2>/dev/null || true
      git grep -lEi "Hydratation rapide|Quick hydration|water.title|water.log|water.logged" -- "*.ts" "*.tsx" 2>/dev/null || true
    } | sort -u
  )

  echo "$CANDIDATES"
  echo ""

  echo "============================================================"
  echo "### 7. Extraits utiles des fichiers candidats"
  echo "============================================================"

  for f in $CANDIDATES; do
    [ -f "$f" ] || continue
    echo ""
    echo "------------------------------------------------------------"
    echo "FILE: $f"
    echo "------------------------------------------------------------"

    grep -nEi "client_water_logs|caffeine_mg|amount_ml|espresso|lungo|café|coffee|caféine|caffeine|matcha|infusion|Hydratation rapide|Quick hydration|water.title|water.log|water.logged|charge active|mg/100ml|loguer" "$f" || true

    echo ""
    echo "----- imports + début fichier -----"
    nl -ba "$f" | sed -n '1,120p'

    echo ""
    echo "----- autour des inserts/logs -----"
    MATCH_LINES=$(grep -nEi "client_water_logs|caffeine_mg|amount_ml|insert|upsert|fetch|POST|PATCH" "$f" | cut -d: -f1 | sort -n | uniq || true)

    for line in $MATCH_LINES; do
      start=$((line-30))
      end=$((line+50))
      [ "$start" -lt 1 ] && start=1
      echo ""
      echo ">>> $f:$line"
      nl -ba "$f" | sed -n "${start},${end}p"
    done
  done

  echo ""
  echo "============================================================"
  echo "FIN AUDIT STRICT"
  echo "============================================================"

} > "$REPORT"

echo "✅ Audit strict terminé."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle-moi uniquement celui-ci avec :"
echo "cat $REPORT"
