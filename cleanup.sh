#!/bin/bash
# 🧹 VIRTUS SMART FIT CLEANUP SCRIPT
# Nettoie le projet avant implémentation VIRTUS Smart fit complète

set -e  # Exit on error

echo "🧹 VIRTUS SMART FIT - NETTOYAGE AUTOMATISÉ"
echo "======================================"
echo ""

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour confirmer
confirm() {
    read -p "$(echo -e ${YELLOW}$1${NC}) (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Annulé par l'utilisateur"
        exit 1
    fi
}

echo "⚠️  PRÉCAUTION: Créer backup avant nettoyage?"
confirm "Voulez-vous créer genesis-lab-backup/?"

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Création backup..."
    cd ..
    cp -r genesis-lab genesis-lab-backup
    cd genesis-lab
    echo "✅ Backup créé: ../genesis-lab-backup/"
    echo ""
fi

echo "🔍 AUDIT PRÉ-NETTOYAGE:"
echo "----------------------"
du -sh . 2>/dev/null || echo "Taille actuelle: $(ls -lh | wc -l) fichiers"
echo ""

# PRIORITÉ 1 - Supprimer dead code
echo "🗑️  PRIORITÉ 1: Suppression dead code..."

items_to_delete=(
    "_OLD_REFERENCE"
    "GEN1"
    "GEN3"
    "app/[id]"
    "app/genesis"
    ".DS_Store"
    "Icon"
    "tsconfig.tsbuildinfo"
    "test-import.ts"
    "update_calculators.py"
)

for item in "${items_to_delete[@]}"; do
    if [ -e "$item" ]; then
        rm -rf "$item"
        echo -e "${GREEN}✓${NC} Supprimé: $item"
    else
        echo -e "${YELLOW}⊘${NC} N'existe pas: $item"
    fi
done
echo ""

# PRIORITÉ 2 - Archiver documentation
echo "📦 PRIORITÉ 2: Archivage documentation excessive..."

mkdir -p docs/archives

docs_to_archive=(
    "AUDIT_COHERENCE.md"
    "CONSISTENCY_CHECK.md"
    "DEPLOYMENT_GUIDE.md"
    "ENV_CHECKLIST.md"
    "ERROR_REPORT.md"
    "FINAL_AUDIT.md"
    "INSTALL_SYSTEMIA.md"
    "NEXT_STEPS.md"
    "OPTIMIZATION_REPORT.md"
    "PUBLIER_EN_LIGNE.md"
    "QUICK_DEPLOY.md"
    "RESPONSIVE_AUDIT_REPORT.md"
    "RESPONSIVE_FIXES_QUICK_REFERENCE.md"
    "VERIFICATION_FINALE.md"
)

for doc in "${docs_to_archive[@]}"; do
    if [ -f "$doc" ]; then
        mv "$doc" docs/archives/
        echo -e "${GREEN}✓${NC} Archivé: $doc → docs/archives/"
    else
        echo -e "${YELLOW}⊘${NC} N'existe pas: $doc"
    fi
done
echo ""

# Nettoyer node_modules si présent (ne devrait jamais être commité)
if [ -d "node_modules" ]; then
    echo "⚠️  node_modules/ détecté (ne devrait pas être dans git)"
    confirm "Supprimer node_modules/? (sera réinstallé avec npm install)"
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf node_modules
        echo -e "${GREEN}✓${NC} node_modules/ supprimé"
    fi
    echo ""
fi

# RÉSUMÉ POST-NETTOYAGE
echo "✅ NETTOYAGE TERMINÉ!"
echo "===================="
echo ""
echo "📊 RÉSUMÉ:"
du -sh . 2>/dev/null || echo "Nouvelle taille: $(ls -lh | wc -l) fichiers"
echo ""
echo "📁 STRUCTURE OPTIMISÉE:"
echo "  ✅ app/          - Production code uniquement"
echo "  ✅ components/   - UI components"
echo "  ✅ lib/          - Utilities"
echo "  ✅ types/        - TypeScript types"
echo "  ✅ public/       - Assets"
echo "  ✅ supabase/     - DB (vide, prêt PHASE 1)"
echo "  ✅ docs/         - Documentation essentielle"
echo "     └── archives/ - Anciennes docs sauvegardées"
echo ""
echo "🎯 PROCHAINES ÉTAPES:"
echo "  1. Vérifier que tout fonctionne: npm run dev"
echo "  2. Commit nettoyage: git add . && git commit -m 'Clean project structure'"
echo "  3. Prêt pour implémentation VIRTUS Smart fit!"
echo ""
echo "💾 Backup disponible: ../genesis-lab-backup/"
