# Rapport d'Erreurs - Genesis Diagnostic

## 📁 app/genesis-lab/page.tsx

### ❌ Erreurs Critiques

#### 1. **Déclaration de fonction dupliquée (Lignes 5-7)**
```typescript
export default function GenesisLandingPage() {

export default function GenesisLandingPage() {
```
**Problème** : La fonction `GenesisLandingPage` est déclarée deux fois, ce qui provoque une erreur de syntaxe.

**Solution** : Supprimer la première déclaration (lignes 5-6) et garder uniquement la ligne 7.

---

#### 2. **Section Calculator dupliquée et syntaxe invalide (Lignes 607-625)**
```typescript
      {/* Calculator */}
      <section {/* Calculator */}
<section id="calculator" className="px-6 py-32 bg-gradient-to-b from-white to-clinical-50/30">
  <div className="max-w-5xl mx-auto">
    <div className="text-center mb-16">
      <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-gray-900">
        Calcule ton IPT
      </h2>
      ...
    </div>
    <IPTCalculator />
  </div>
</section> className="px-6 py-40 max-w-5xl mx-auto text-center">
```
**Problème** : 
- Commentaire et balise `<section>` mal formatés
- Section dupliquée avec deux attributs `className` différents
- Le nouveau code est imbriqué dans l'ancien code
- Syntaxe JSX invalide

**Solution** : Remplacer toute la section (lignes 607-646) par :
```typescript
      {/* Calculator */}
      <section id="calculator" className="px-6 py-32 bg-gradient-to-b from-white to-clinical-50/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-gray-900">
              Calcule ton IPT
            </h2>
            <p className="text-lg md:text-xl text-gray-600 mb-4">
              48 questions. 10 minutes. Résultat instant.
            </p>
            <p className="font-mono text-sm text-gray-500">
              100% gratuit. Aucune carte bancaire requise.
            </p>
          </div>
          <IPTCalculator />
        </div>
      </section>
```

**Note** : Le style `bg-gradient-to-b from-white to-clinical-50/30` semble être pour un fond blanc, mais le site utilise un fond sombre (`bg-[#021a18]`). À ajuster selon le design souhaité.

---

## 📁 components/calculator/IPTCalculator.tsx

### ❌ Erreurs Critiques

#### 1. **Imports et déclaration incorrects au début du fichier (Lignes 1-5)**
```typescript
"use client"
import IPTCalculator from '@/components/calculator/IPTCalculator'

export default function GenesisLandingPage() 

import { useState } from 'react'
```
**Problème** :
- Le fichier contient des éléments qui appartiennent à `page.tsx` (import de `IPTCalculator` et déclaration de `GenesisLandingPage`)
- La déclaration `export default function GenesisLandingPage()` est incomplète (pas de corps de fonction)
- L'import de `IPTCalculator` dans son propre fichier crée une référence circulaire

**Solution** : Supprimer les lignes 1-5 et commencer directement avec :
```typescript
"use client"

import { useState } from 'react'
import calculatorData from '@/lib/questionnaires/ipt-calculator.json'
```

---

#### 2. **Problème potentiel : Classes Tailwind personnalisées**
Le fichier utilise `clinical-50` qui n'est peut-être pas défini dans la configuration Tailwind. Vérifier que cette couleur est bien définie dans `tailwind.config.js`.

---

## 📋 Résumé des corrections nécessaires

### app/genesis-lab/page.tsx
1. ✅ Supprimer les lignes 5-6 (déclaration dupliquée)
2. ✅ Corriger la section Calculator (lignes 607-646) - remplacer par la version propre
3. ⚠️ Vérifier la cohérence des styles (fond blanc vs fond sombre)

### components/calculator/IPTCalculator.tsx
1. ✅ Supprimer les lignes 1-5 (code qui appartient à page.tsx)
2. ⚠️ Vérifier que `calculatorData` existe dans `@/lib/questionnaires/ipt-calculator.json`
3. ⚠️ Vérifier la configuration Tailwind pour `clinical-50`

---

## 🔧 Actions Recommandées

1. ✅ **Nettoyer page.tsx** : Supprimer la duplication de fonction et corriger la section Calculator
2. ✅ **Nettoyer IPTCalculator.tsx** : Retirer les imports/déclarations incorrects
3. ⚠️ **Vérifier les dépendances** : S'assurer que tous les imports existent (calculatorData.json)
4. ✅ **Tester** : Compiler le projet pour vérifier qu'il n'y a plus d'erreurs

---

## ✅ Corrections Appliquées

### app/genesis-lab/page.tsx
- ✅ Suppression de la déclaration de fonction dupliquée (lignes 5-6)
- ✅ Correction de la section Calculator avec syntaxe JSX valide
- ✅ Import de IPTCalculator correctement intégré

### components/calculator/IPTCalculator.tsx
- ✅ Suppression des imports incorrects (lignes 1-5)
- ✅ Fichier nettoyé et prêt à l'utilisation

**⚠️ Note importante** : Le composant IPTCalculator nécessite que le fichier `@/lib/questionnaires/ipt-calculator.json` existe avec la structure de données attendue. Vérifier que ce fichier existe et contient les sections et questions nécessaires.

