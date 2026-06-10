# STRYVR — Design System v1.0 Reference

> **Document canonique d'implémentation Front-End.**
> Soft-Brutalisme : Rigueur mathématique, contrastes forts, typographie architecturale.

---

## 1. Système Chromatique (Design Tokens)

Toute couleur utilisée doit référencer les variables CSS ci-dessous. **Les valeurs hard-codées sont interdites.**

### CSS Custom Properties (Root)

```css
:root {
  /* Surfaces & Conteneurs */
  --bg-app: #f0efe7; /* Fond principal — papier chaud */
  --bg-panel-dark: #343434; /* Panneaux d'action / Barre latérale */
  --bg-panel-light: #f8f8f8; /* Cartes de contenu interne */
  --bg-card-neutral: #d8d7ce; /* Éléments secondaires */

  /* Typographie */
  --text-main: #242424; /* Titres et corps sur fond clair */
  --text-muted: #535353; /* Labels, métadonnées, légendes */
  --text-on-dark: #ffffff; /* Texte blanc sur fond anthracite */
  --text-on-dark-muted: rgba(255, 255, 255, 0.4);

  /* Accentuation */
  --accent-primary: #fcf76e; /* Jaune acide — CTAs uniquement */
  --accent-success: #4a7b59; /* Vert — Statuts positifs (rare) */

  /* Bordures */
  --border-subtle: 1px solid #bcbcb8;

  /* Géométrie */
  --radius-pill: 9999px; /* Boutons, Tags, Avatars */
  --radius-card-lg: 24px; /* Panneaux principaux */
  --radius-card-sm: 12px; /* Inputs et cartes internes */
}
```

### Mapping Tailwind CSS (Rapide)

| Utilisation     | CSS Var             | Tailwind                | Hex     |
| --------------- | ------------------- | ----------------------- | ------- |
| Fond app        | `--bg-app`          | `bg-background`         | #F0EFE7 |
| Panel sombre    | `--bg-panel-dark`   | `bg-dark`               | #343434 |
| Panel léger     | `--bg-panel-light`  | `bg-surface-raised`     | #F8F8F8 |
| Card neutre     | `--bg-card-neutral` | `bg-surface`            | #D8D7CE |
| Texte principal | `--text-main`       | `text-primary`          | #242424 |
| Texte muted     | `--text-muted`      | `text-muted-foreground` | #535353 |
| Texte sur dark  | `--text-on-dark`    | `text-white`            | #FFFFFF |
| Accent jaune    | `--accent-primary`  | `bg-accent`             | #FCF76E |
| Accent vert     | `--accent-success`  | `text-green-700`        | #4A7B59 |

---

## 2. Grille d'Espacement (Unité 8px)

**Tous les multiples de 8px. Aucune exception.**

| Token        | Valeur | Usage                             |
| ------------ | ------ | --------------------------------- |
| `--space-xs` | 8px    | Écart icône/texte                 |
| `--space-sm` | 16px   | Padding boutons, petit composants |
| `--space-md` | 24px   | Gouttière (cartes, champs)        |
| `--space-lg` | 32px   | Padding panneaux sombres          |
| `--space-xl` | 48px   | Espacement sections majeures      |

### Implémentation Tailwind

- `p-2` = 8px
- `p-4` = 16px
- `p-6` = 24px
- `p-8` = 32px
- `p-12` = 48px

**Règle de densité :** Si une vue semble complexe, augmentez d'abord via `space-lg` (32px) plutôt que de réduire la taille de police.

---

## 3. Typographie & Hiérarchie

Police : **SP Pro Display** (ou fallback Inter). La hiérarchie est créée par taille + graisse, **jamais par couleur seule.**

| Niveau           | Taille | Weight | Letter Spacing | Usage                | Classe Tailwind          |
| ---------------- | ------ | ------ | -------------- | -------------------- | ------------------------ |
| **H1 Display**   | 32px   | 600    | -0.02em        | Titres majeurs       | `text-2xl font-semibold` |
| **H2 Section**   | 20px   | 600    | -0.01em        | Sous-titres section  | `text-xl font-semibold`  |
| **Body Main**    | 14px   | 500    | 0              | Corps standard       | `text-base font-medium`  |
| **Label / Meta** | 12px   | 400    | 0              | Métadonnées          | `text-xs font-regular`   |
| **Small Caps**   | 11px   | 700    | 0.05em         | Mini-données (UPPER) | `text-2xs font-bold`     |

### Accessibilité typographique

- Toujours `line-height ≥ 1.5` pour lisibilité
- Pas d'algorithme d'espacement chaotique — utiliser les presets Tailwind
- Données numériques = `font-mono` toujours

---

## 4. Géométrie (Border Radius)

| Token              | Valeur | Usage                                      |
| ------------------ | ------ | ------------------------------------------ |
| `--radius-pill`    | 9999px | Boutons, Tags, Avatars, Pills              |
| `--radius-card-lg` | 24px   | Panneaux principaux, conteneurs de section |
| `--radius-card-sm` | 12px   | Inputs, sous-cartes                        |

### Implémentation

```tsx
// Bouton → pill
<Button className="rounded-full" />

// Panneaux majeurs
<div className="rounded-[24px]" />

// Inputs
<input className="rounded-[12px]" />
```

---

## 5. Système d'Interactions (Micro-Animations)

### Transition Globale

```css
--transition-premium: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

### États des Composants

#### 1. **Hover (Survol)**

- **Bouton Principal** (accent-primary): `filter: brightness(0.95)`
- **Bouton Neutre**: `background-color: #E2E1D9`
- **Carte Sombre**: `background-color: #404040`
- **Lien**: `text-decoration: underline; opacity: 0.8`

#### 2. **Active (Clic)**

- Sensation de pression : `transform: scale(0.97)`
- Durée : 100ms

#### 3. **Focus (Clavier)**

```css
:focus-visible {
  outline: 2px solid var(--text-main);
  outline-offset: 2px;
}
```

**Jamais de focus par défaut** sur les éléments visuels — utiliser `:focus-visible` uniquement.

#### 4. **Disabled**

```css
opacity: 0.5;
cursor: not-allowed;
pointer-events: none;
```

---

## 6. Règles de Mise en Page (Layout Constraints)

### Alignement

- **Texte** : Toujours Left-aligned par défaut
- **Centrage** : **Proscrit** sauf cas très spécifiques (splash screens)

### Contraste sur Panneaux Sombres

Tout élément interactif sur `--bg-panel-dark` doit avoir un fond blanc pur (`#FFFFFF`) pour garantir le contraste :

```tsx
// Sur fond #343434
<input className="bg-white text-primary" />
<Button className="bg-white text-primary" />
```

### Max-Width Sections

- Pages côté coach : `max-w-4xl` (1024px)
- Modals : `max-w-2xl` (672px)
- Panneaux droite (drawers) : `w-80` (320px)

---

## 7. Utilisation Pratique

### Exemple : Card Standard

```tsx
<div className="bg-surface rounded-[24px] border border-subtle p-6 space-y-4">
  <h2 className="text-xl font-semibold text-primary">Titre</h2>
  <p className="text-base text-muted-foreground">Description</p>
  <Button className="bg-accent text-black rounded-full">Action</Button>
</div>
```

### Exemple : Panel Sombre

```tsx
<div className="bg-dark rounded-[24px] p-8">
  <h3 className="text-white">Autorité</h3>
  <input className="bg-white text-primary rounded-[12px] p-4 mt-4" />
</div>
```

### Exemple : Micro-interactions

```tsx
<button className="transition-all duration-200 hover:brightness-95 active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
  Action
</button>
```

---

## 8. Checklist Conformité

- [ ] Toutes les couleurs référencent `--bg-*`, `--text-*`, `--accent-*`, ou `--border-*`
- [ ] Grille d'espacement = multiples de 8px uniquement
- [ ] Typographie respecte la hiérarchie (taille + weight, pas couleur seule)
- [ ] Border radius : pill (9999px), card-lg (24px), card-sm (12px)
- [ ] Micro-interactions : hover, active, focus-visible implémentées
- [ ] Texte Left-aligned par défaut
- [ ] Inputs sur panneaux sombres = fond blanc `#FFFFFF`

---

**Dernière mise à jour :** 2026-04-06
**Version :** 1.0
**Créé pour :** STRYVR Design System Alignment
