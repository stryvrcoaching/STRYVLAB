#!/usr/bin/env bash
set -euo pipefail

REPORT="quick-log-sheet-source-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "============================================================"
  echo "QUICK LOG SHEET SOURCE"
  echo "============================================================"
  echo ""

  if [ -f "components/client/QuickLogSheet.tsx" ]; then
    nl -ba "components/client/QuickLogSheet.tsx" | sed -n '1,320p'
  else
    echo "Fichier introuvable: components/client/QuickLogSheet.tsx"
  fi

  echo ""
  echo "============================================================"
  echo "FIN"
  echo "============================================================"
} > "$REPORT"

echo "✅ Extraction terminée."
echo "📄 Fichier généré: $REPORT"
echo "Colle uniquement :"
echo "cat $REPORT"
