# System Prompt — STRYVR Landing Page

> Usage : copier ce prompt dans une nouvelle conversation pour mandater l'agent sur la landing STRYVR.
> Dernière mise à jour : 2026-05-16 — DA Technogym adoptée

---

## Contexte projet

Tu travailles sur **STRYVR**, app mobile native de coaching ultra-personnalisé (moteur physiologique : nutrition, entraînement, cycle féminin, safety layer).

Fichiers landing (tous dans `/app/stryvr/`) :
- `components/BetaLandingClient.tsx` — landing complète
- `components/AppMockup.tsx` — `AgendaScreen`, `TrainingScreen`, `HeroPhoneStack`
- `components/BetaForm.tsx` — formulaire prénom + email
- `page.tsx` — Server Component, Urbanist font, `getBetaCount()`
- `actions.ts` — Server Actions `joinWaitlist()` + `getBetaCount()`

Spec design de référence : `docs/superpowers/specs/2026-05-14-stryvr-beta-landing-design.md`

---

## DA Technogym — tokens (source de vérité)

```ts
const BG   = '#0a0a0a';  // fond — noir pur
const CARD = '#161616';  // card
const BD   = 'rgba(255,255,255,0.08)';  // border
const AC   = '#F5D800';  // JAUNE — CTA + marqueurs actifs UNIQUEMENT
```

**Usage accent jaune `#F5D800` :**
- ✅ CTA button (fond jaune, texte noir)
- ✅ Badge BÊTA (border + texte)
- ✅ Numéros de feature (01/02/03)
- ✅ Barres actives dans les mockups
- ✅ Dots statut actif
- ✅ `<span>` dans headlines (1 seul par headline max)
- ❌ JAMAIS fond de section
- ❌ JAMAIS texte courant/description
- ❌ JAMAIS multiple par section

**Typographie :**
- Urbanist, chargé via `next/font/google` + `font-[family-name:var(--font-urbanist)]`
- Headlines : uppercase, weight 800-900, `letterSpacing: '-0.03em'` à `'-0.04em'`
- Labels/eyebrow : 9-10px, weight 700, `letterSpacing: '0.14em'`, uppercase, couleur AC
- Boutons CTA : 12px, weight 800, uppercase, `letterSpacing: '0.12em'`
- Boutons outline : `border: '1px solid rgba(255,255,255,0.35)'`, couleur `#ffffff`

**Grille industrielle :**
```tsx
// Technique gap-1px — PAS de border sur les cellules
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: 'rgba(255,255,255,0.08)' }}>
  <div style={{ backgroundColor: '#0a0a0a', padding: '40px 32px' }}>...</div>
  ...
</div>
```

**Mockup TrainingScreen :**
- Barres verticales : `borderRadius: 0` (style Technogym strict)
- Barres actives : `#F5D800`, inactives : `#2a2a2a`
- Courbe sinusoïdale SVG bézier, balle blanche, losanges `#F5D800` aux cibles
- Stats : REPS en jaune, CHARGE + TEMPS en blanc

---

## Règles non-négociables

```
✓ Fond #0a0a0a — jamais zinc #111115 ni #09090b
✓ Accent #F5D800 — jamais #FF6116 ni #1F8A65 sur cette page
✓ Typo uppercase bold 800-900
✓ borderRadius: 0 sur les barres des mockups
✓ Grille gap-1px pour les sections features/safety
✓ Zéro glassmorphism sauf navbar (backdrop-blur)
✓ Zéro gradient décoratif
✓ Zéro shadow portée
✗ JAMAIS utiliser l'orange #FF6116 (DS v3.0 natif) sur la landing
✗ JAMAIS le vert #1F8A65 (DS v2.0 coach) sur la landing
```

---

## Livraison attendue (tout changement landing)

1. Fichiers modifiés dans `app/stryvr/`
2. `CHANGELOG.md` mis à jour
3. `npx tsc --noEmit` — 0 erreurs TypeScript dans `app/stryvr/`
4. Commit atomique
