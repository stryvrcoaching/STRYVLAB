#!/usr/bin/env bash
set -euo pipefail

REPORT="cafe-source-extract-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "SOURCE CAFÉ / THÉ - $(date)"
  echo "============================================================"
  echo ""

  echo "### 1. Repo"
  pwd
  git branch --show-current 2>/dev/null || true
  git status --short 2>/dev/null || true
  echo ""

  echo "============================================================"
  echo "### 2. lib/client/nutrition/drinks.ts"
  echo "============================================================"
  if [ -f "lib/client/nutrition/drinks.ts" ]; then
    nl -ba "lib/client/nutrition/drinks.ts" | sed -n '1,260p'
  else
    echo "Fichier introuvable: lib/client/nutrition/drinks.ts"
  fi

  echo ""
  echo "============================================================"
  echo "### 3. app/client/nutrition/compose/ComposeClientPage.tsx"
  echo "============================================================"
  if [ -f "app/client/nutrition/compose/ComposeClientPage.tsx" ]; then
    nl -ba "app/client/nutrition/compose/ComposeClientPage.tsx" | sed -n '1,900p'
  else
    echo "Fichier introuvable: app/client/nutrition/compose/ComposeClientPage.tsx"
  fi

  echo ""
  echo "============================================================"
  echo "### 4. Imports locaux depuis ComposeClientPage"
  echo "============================================================"
  if [ -f "app/client/nutrition/compose/ComposeClientPage.tsx" ]; then
    grep -nE "^import .* from ['\"]@" "app/client/nutrition/compose/ComposeClientPage.tsx" || true
    grep -nE "^import .* from ['\"]\." "app/client/nutrition/compose/ComposeClientPage.tsx" || true
  fi

  echo ""
  echo "============================================================"
  echo "FIN SOURCE CAFÉ / THÉ"
  echo "============================================================"
} > "$REPORT"

echo "✅ Extraction terminée."
echo "📄 Fichier généré: $REPORT"
echo ""
echo "Colle uniquement :"
echo "cat $REPORT"
