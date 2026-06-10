# STRYVR Design System v2.0 — Référence Canonique

> Établi le 2026-04-06 à partir de `app/page.tsx` (homepage).
> Ce fichier est la source de vérité design. Toute décision UI doit s'y conformer.

---

## Philosophie

**Flat. Dark. Sans bruit.**

La hiérarchie visuelle ne s'exprime pas par des bordures ou des ombres, mais par :

- La nuance de couleur de fond (trois niveaux de noir)
- L'opacité du texte (blanc à différents pourcentages)
- La densité du contenu

Référence stylistique : Cursor (dashboard IDE).

---

## Système chromatique

### Fonds — trois niveaux de noir

| Niveau          | Hex       | Usage                                                    |
| --------------- | --------- | -------------------------------------------------------- |
| Fond app        | `#121212` | Page entière — jamais utilisé sur un bloc                |
| Surface bloc    | `#181818` | Tous les blocs principaux (landing, auth, cards)         |
| Surface input   | `#0a0a0a` | Champs texte, selects — toujours plus sombre que le bloc |
| Surface tooltip | `#0f0f0f` | Tooltips uniquement                                      |

**Règle** : les deux blocs côte-à-côte ont exactement la même couleur `#181818`. L'identité visuelle repose sur la forme et le contenu, pas sur des couleurs différentes.

### Accent

| Rôle             | Hex       | Usage                                                            |
| ---------------- | --------- | ---------------------------------------------------------------- |
| Accent principal | `#1f8a65` | CTA, boutons primaires, progress bar, icones actives, sélections |
| Accent hover     | `#217356` | Hover sur bouton accent uniquement                               |
| Accent fond      | `#1f4637` | Fond de confirmation/succès (très transparent, `/30`)            |

### Texte — opacités

| Rôle             | Classe Tailwind | Hex approx. |
| ---------------- | --------------- | ----------- |
| Titre principal  | `text-white`    | `#ffffff`   |
| Corps / features | `text-white/90` | `#e6e6e6`   |
| Description      | `text-white/60` | `#999999`   |
| Feature desc     | `text-white/45` | `#737373`   |
| Section label    | `text-white/40` | `#666666`   |
| Label champ      | `text-white/55` | `#8c8c8c`   |
| Placeholder      | `text-white/20` | `#333333`   |

### Overlays (fonds semi-transparents blancs)

| Usage                       | Classe                                |
| --------------------------- | ------------------------------------- |
| Zone neutre (icones outils) | `bg-white/[0.04]`                     |
| Hover neutre                | `bg-white/[0.05]` à `bg-white/[0.08]` |
| Icone feature neutre        | `bg-white/[0.07]`                     |
| Chips inactifs              | `bg-white/[0.02]`                     |
| Bouton retour               | `bg-white/[0.03]`                     |

---

## Typographie

### Familles

| Famille     | Variable CSS                 | Usage                                       |
| ----------- | ---------------------------- | ------------------------------------------- |
| Lufga       | `--font-lufga` / `font-sans` | Tout le texte UI — corps, labels, boutons   |
| Unbounded   | `--font-unbounded`           | Logo STRYV **uniquement** — jamais ailleurs |
| Azonix      | `--font-azonix`              | Réservé au symbole "S" du logo              |
| System mono | `font-mono`                  | Données numériques (poids kg, reps, sets)   |

### Hiérarchie

| Niveau        | Tailwind                                                                                 | Contexte                      |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| Hero          | `text-[2.4rem] md:text-[2.8rem] xl:text-[3rem] font-black tracking-tight leading-[1.05]` | H1 page                       |
| Bloc title    | `text-xl font-semibold tracking-tight`                                                   | Titre bloc auth               |
| Section label | `text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40`                    | Sections landing              |
| Field label   | `text-[10px] font-bold uppercase tracking-[0.18em] text-white/55`                        | Au-dessus des inputs          |
| Feature label | `text-[12px] font-medium text-white/90 leading-snug`                                     | Titre d'une feature row       |
| Feature desc  | `text-[11px] text-white/45 leading-relaxed`                                              | Description d'une feature row |
| Corps         | `text-[13px] text-white/60 leading-[1.7]`                                                | Paragraphes, hints            |
| Hint small    | `text-[11px] font-medium text-white/55`                                                  | Sous-titres formulaire        |
| Input         | `text-[14px] font-medium text-white`                                                     | Champs de saisie              |
| Bouton CTA    | `text-[12px] font-bold uppercase tracking-[0.12em]`                                      | Bouton primaire               |
| Stat value    | `text-xl font-black text-[#1f8a65]`                                                      | Chiffres clés                 |
| Stat label    | `text-[9.5px] font-medium text-white/50`                                                 | Label sous chiffre            |
| Tool name     | `text-[8px] font-medium text-white/45`                                                   | Sous les icones d'outils      |
| Badge NEW     | `text-[6px] font-black uppercase`                                                        | Badge sur icone outil         |

---

## Géométrie

### Radius

| Contexte                     | Classe         | Valeur |
| ---------------------------- | -------------- | ------ |
| Blocs principaux             | `rounded-2xl`  | 16px   |
| Inputs, selects, icones auth | `rounded-xl`   | 12px   |
| Feature rows hover, chips    | `rounded-lg`   | 8px    |
| Icones d'outils grille       | `rounded-lg`   | 8px    |
| Badges (NEW, etc.)           | `rounded-full` | 9999px |
| Icone CTA interne            | `rounded-lg`   | 8px    |
| Tooltips                     | `rounded-xl`   | 12px   |

### Règle

- Pas de `rounded-md` ou `rounded-sm` — trop abrupt pour ce style
- Les deux extrêmes : `rounded-full` (badges/pills) et `rounded-2xl` (blocs)

---

## Espacement

Tous les espacements sont multiples de 4px.

| Usage                | Valeur                               |
| -------------------- | ------------------------------------ |
| Padding externe page | `p-4 md:p-6 lg:p-8 xl:p-10`          |
| Padding interne bloc | `p-8 lg:p-10 xl:p-12`                |
| Gap entre blocs      | `gap-6`                              |
| Gap entre sections   | `mb-6` à `mb-8`                      |
| Gap feature rows     | pas de gap — `py-2.5` sur chaque row |
| Gap grille outils    | `gap-1.5`                            |
| Padding input        | `px-4`, hauteur fixe `h-[52px]`      |
| Padding bouton CTA   | `pl-5 pr-1.5`, hauteur `h-[52px]`    |

---

## Règles absolues

### Ce qui est INTERDIT

| Interdit                                  | Raison                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| `shadow-*`                                | Design flat — pas d'ombres                              |
| `gradient-*` décoratifs                   | Design monochrome                                       |
| Focus natif bleu sur cartes / liens       | Design flat — utiliser un style de focus DS brandé      |
| Hex hardcodé hors palette                 | Utiliser les classes documentées                        |
| shadcn `<Input>`, `<Label>`, `<Progress>` | Conflits de style avec base-ui — utiliser du HTML natif |
| `confirm()` / `alert()` navigateur        | Utiliser un modal branded                               |
| `TooltipTrigger asChild`                  | Non supporté par base-ui                                |
| `TooltipProvider delayDuration`           | base-ui utilise `delay`                                 |
| Nom de l'outil dans le tooltip            | Le nom est déjà affiché sous l'icone                    |

### Bordures fines — OBLIGATOIRE sur tous les éléments

Tous les éléments (blocs, cards, inputs, boutons, modals) ont une bordure `border-[0.3px]` pour la définition visuelle.

**Source de vérité** : `app/coach/organisation/page.tsx` et `components/layout/CoachShell.tsx`.

| Élément                    | Classe exacte                          | Notes                              |
| -------------------------- | -------------------------------------- | ---------------------------------- |
| Blocs principaux / cards   | `border-[0.3px] border-white/[0.06]`   | Toutes les cartes coach            |
| Cards stats (`bg-[#181818]`) | `border-[0.3px] border-white/[0.06]` | Même valeur                        |
| Sidebar / TopBar           | `border-subtle` (= `#2A2A2A`)          | Via token Tailwind, pas inline     |
| Inputs, selects            | `border-[0.3px] border-white/[0.06]`   | Fond `#0a0a0a`                     |
| Boutons secondaires        | `border-[0.3px] border-white/[0.06]`   | Avec `bg-white/[0.04]`             |
| Séparateurs horizontaux    | `border-t-[0.3px] border-white/[0.06]` | Ou `border-b border-white/[0.04]`  |
| Bordures colorées (accent) | `border-[0.3px] border-[#1f8a65]/20`   | État actif / sélection             |
| Bordures warning           | `border-[0.3px] border-amber-500/20`   | Blocs warning uniquement           |

**Règle absolue** :
- Toujours `border-[0.3px]` — jamais `border` (1px, trop épais) ni des opacités sous `0.04` (invisibles sur la plupart des écrans).
- L'opacité standard est **`/[0.06]`** pour tous les éléments neutres.
- Ne jamais utiliser `border-white/[0.013]`, `border-white/[0.016]`, `border-white/[0.02]` — ces valeurs sont trop basses et ne s'affichent pas sur écran standard.

---

## Architecture Globale — Sections Coach/Client

### Règle 1 : TopBar = Unique Header/Navigation

La **top bar globale est l'unique source de navigation et de header** pour toutes les sections (coach, client, assessments, etc.).

#### Pattern : `useSetTopBar` injection

```tsx
import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";

export default function CoachClientsPage() {
  // Contenu gauche : section label + titre principal
  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
          Espace Coach
        </p>
        <p className="text-[13px] font-semibold text-white leading-none">
          Clients
        </p>
      </div>
    ),
    [],
  );

  // Contenu droit : boutons d'action
  const topBarRight = useMemo(
    () => (
      <button
        onClick={() => router.push("/coach/clients/new")}
        className="flex items-center gap-2 px-4 h-8 rounded-lg bg-[#1f8a65] text-[12px] font-bold text-white hover:bg-[#217356] transition-colors active:scale-[0.98]"
      >
        <Plus size={13} />
        Nouveau client
      </button>
    ),
    [router],
  );

  // Injecter dans la top bar globale
  useSetTopBar(topBarLeft, topBarRight);

  // Retour : UNIQUEMENT le contenu main sans header sticky
  return (
    <main className="min-h-screen bg-[#121212] font-sans">
      <div className="p-8 max-w-3xl mx-auto">
        {/* Contenu page — jamais de header/sticky redondant */}
      </div>
    </main>
  );
}
```

**Règles strictes :**

- ✅ Toujours `useMemo` pour topBarLeft et topBarRight (pas de re-renders inutiles)
- ✅ Appeler `useSetTopBar()` DANS le composant (pas dans les enfants)
- ✅ Les pages de hub ou d'outil peuvent placer un bouton retour dans `topBarLeft` pour conserver une seule navigation globale
- ✅ La sidebar coach reste la navigation structurelle par défaut, le top bar complète cette navigation sans la remplacer
- ❌ JAMAIS de sticky header redondant dans le contenu main
- ❌ JAMAIS de titre/boutons action en dehors de topBarLeft/topBarRight
- Modals, drawers flottants : OK seulement s'ils ne remplacent pas la top bar

### Règle TopBar : boutons d’action

Les boutons dans `topBarRight` doivent être compacts, cohérents et hiérarchisés.

- ✅ Hauteur standard : `h-8` pour les boutons de top bar.
- ✅ Rayon : `rounded-lg`.
- ✅ Typographie : `text-[12px] font-bold uppercase tracking-[0.12em]`.
- ✅ Espacement interne : `px-4` pour un bouton principal, `px-3` pour un bouton secondaire.
- ✅ Icônes : `gap-2` entre l’icône et le label.
- ✅ Bouton primaire : `bg-[#1f8a65] text-white hover:bg-[#217356] active:scale-[0.98]`.
- ✅ Bouton secondaire : `bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80`.
- ✅ Groupes : `topBarRight` peut contenir plusieurs actions, mais rester limité à 2 actions principales.
- ✅ Actions conditionnelles : afficher uniquement les boutons pertinents selon l’état de la page. Exemple :
  - `Nouveau tableau Kanban` visible uniquement en mode `kanban`
  - `Nouvelle tâche` visible en `kanban` et `agenda`
- ❌ Pas de bouton de top bar à `h-[52px]` ou format page hero.
- ❌ Éviter les boutons top bar trop larges ou trop hauts qui cassent l’équilibre visuel.

### Règle : groupe de bascule de vue

Les boutons de changement de vue (grille / liste) doivent rester compacts, cohérents et visuellement liés.

- ✅ Conteneur : `flex items-center gap-0.5 bg-[#181818] border-subtle rounded-xl p-1`.
- ✅ Boutons : `flex items-center justify-center w-8 h-8 rounded-lg transition-all`.
- ✅ État actif : `bg-white/[0.08] text-white`.
- ✅ État inactif : `text-white/30 hover:text-white/60`.
- ✅ Icônes : `LayoutGrid` pour la vue grille, `List` pour la vue liste.
- ✅ Utiliser `aria-pressed` ou un indicateur visuel clair pour l’accessibilité.
- ✅ Exemple : `/coach/clients` utilise ce pattern dans la barre de recherche/filtre.

```tsx
<div className="flex items-center gap-0.5 bg-[#181818] border-subtle rounded-xl p-1">
  <button
    type="button"
    aria-pressed={viewMode === "grid"}
    onClick={() => setViewMode("grid")}
    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${viewMode === "grid" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
  >
    <LayoutGrid size={13} />
  </button>
  <button
    type="button"
    aria-pressed={viewMode === "list"}
    onClick={() => setViewMode("list")}
    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${viewMode === "list" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
  >
    <List size={13} />
  </button>
</div>
```

#### Exemples implémentés

- `/coach/clients` ← Reference pattern (topBarLeft = "Espace Coach" + "Clients", topBarRight = "+ Nouveau client")
- `/coach/assessments` ← Suit le pattern (topBarLeft = "Espace Coach" + "Bilans & Templates", topBarRight = "+ Nouveau")

---

### Règle 2 : Background App = TOUJOURS `#121212` (jamais intermédiaire)

Le fond de page est **TOUJOURS et UNIQUEMENT** `#121212`. Aucun fond intermédiaire `#181818` ou autre teinte grise ne doit être utilisé comme conteneur principal.

#### Hiérarchie des fonds (3 niveaux uniquement)

```
Page entière
└─ bg-[#121212]  ← App background — JAMAIS de surface bloc ici
    ├─ Content area
    │   ├─ Cards : bg-white/[0.02] (hover: bg-white/[0.03])
    │   ├─ Inputs : bg-[#0a0a0a]
    │   └─ Blocs temporaires : bg-white/[0.02] à bg-white/[0.04]
    │
    └─ Modals (container overlay)
        └─ Modal card : bg-[#181818] (SEUL cas où #181818 est OK)
```

**Violation courante ❌**

```tsx
// MAUVAIS — #181818 utilisé comme fond principal/conteneur
<main className="min-h-screen bg-[#181818]">
  <div className="flex flex-col gap-4">
    {templates.map((t) => (
      <div className="bg-white/[0.02]">...</div>
    ))}
  </div>
</main>
```

**Correct ✅**

```tsx
// BON — #121212 pour le fond app, white/[0.02] pour les cards
<main className="min-h-screen bg-[#121212]">
  <div className="p-8 max-w-3xl mx-auto">
    {templates.map((t) => (
      <div className="bg-white/[0.02] hover:bg-white/[0.03] transition-colors rounded-xl p-4">
        ...
      </div>
    ))}
  </div>
</main>
```

**Exception unique : Modals**

```tsx
// Modals SEULEMENT — #181818 est autorisé pour la card interne
{
  isOpen && (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-sm">
        {/* Contenu modal */}
      </div>
    </div>
  );
}
```

**Points de vérification — checklist**

- ✅ `<main>` : `bg-[#121212]`
- ✅ `<header>` sticky : `bg-[#121212]` + `border-b border-white/[0.07]` (si nécessaire, sinon supprimer et utiliser topBar)
- ✅ Cards/conteneurs : `bg-white/[0.02]` ou transparent
- ✅ Inputs : `bg-[#0a0a0a]` uniquement
- ✅ Modals : `bg-[#181818]` seulement pour la card overlay
- ❌ Jamais d'intermédiaire `#181818` pour le contenu principal
- ❌ Jamais d'autre teinte grise (#1a1a1a, #151515, #0d0d0d)

---

### Ce qui est OBLIGATOIRE

| Obligatoire                                    | Détail                                      |
| ---------------------------------------------- | ------------------------------------------- |
| Séparateurs `h-px bg-white/[0.07]`             | Entre chaque grande section du bloc landing |
| `active:scale-[0.97]` ou `active:scale-[0.99]` | Sur tout bouton cliquable                   |
| `transition-colors duration-150`               | Sur tout hover de couleur                   |
| `AnimatePresence mode="wait"`                  | Sur les transitions de step de formulaire   |
| Logo STRYV en `font-unbounded`                 | Jamais une autre police pour le logo        |
| `font-mono` sur données numériques             | Poids, reps, sets, charges                  |

---

## Composants de référence

### Layout page (desktop)

```
bg-[#121212]  min-h-screen  flex justify-center  p-4 md:p-6 lg:p-8 xl:p-10
  └─ flex gap-6 max-w-[1200px] items-start
       ├─ LandingColumn  w-[55%]  bg-[#181818]  rounded-2xl  overflow-y-auto  (scrollable)
       └─ AuthCard       w-[45%]  bg-[#181818]  rounded-2xl  fixed overlay    (desktop)
```

### Grille outils (6 colonnes)

```tsx
<div className="grid grid-cols-6 gap-1.5">
  {tools.map((tool) => (
    <Tooltip key={tool.id}>
      <TooltipTrigger>
        <div className="relative group flex flex-col items-center gap-1.5 cursor-default">
          <div className="w-full aspect-square rounded-lg bg-white/[0.04] flex items-center justify-center transition-all duration-150 group-hover:bg-white/[0.08]">
            <Icon
              size={19}
              className="text-white/60 group-hover:text-white transition-colors duration-150"
            />
          </div>
          <span className="text-[8px] font-medium text-white/45 text-center leading-tight">
            {tool.title}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[190px] bg-[#0f0f0f] p-3 text-[11px] leading-relaxed text-white/60 rounded-xl">
        <p>{tool.desc}</p> {/* Pas le nom — il est déjà affiché */}
      </TooltipContent>
    </Tooltip>
  ))}
</div>
```

### Feature Row

```tsx
function FeatureRow({ icon: Icon, label, desc, accent = false }) {
  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-white/[0.04] cursor-default">
      <div
        className={cn(
          "mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          accent
            ? "bg-[#1f8a65]/20 text-[#1f8a65]" // section coach
            : "bg-white/[0.07] text-white/55 group-hover:text-white/80", // section client
        )}
      >
        <Icon size={13} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-white/90 leading-snug">
          {label}
        </p>
        <p className="text-[11px] text-white/45 leading-relaxed mt-0.5">
          {desc}
        </p>
      </div>
    </div>
  );
}
```

### Search bar

Use the default DS v2 input border for search fields in coach pages.

```tsx
<div className="relative flex-1 max-w-sm">
  <Search
    size={14}
    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
  />
  <input
    type="text"
    placeholder="Rechercher un client..."
    className="w-full rounded-xl bg-[#0a0a0a] border-input pl-9 pr-4 h-10 text-[13px] text-white placeholder:text-white/25 outline-none"
  />
</div>
```

- ✅ Background input : `bg-[#0a0a0a]`
- ✅ Border : `border-input`
- ✅ Padding gauche : `pl-9` pour laisser de l’espace à l’icône
- ✅ Taille : `h-10`
- ✅ Placeholder : `text-white/25`

### Bouton CTA complet

```tsx
<button
  type="submit"
  disabled={isLoading}
  className="group/btn flex h-[52px] min-w-0 flex-1 items-center justify-between rounded-xl bg-[#1f8a65] pl-5 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-50"
>
  <div className="flex min-w-0 items-center gap-3">
    <ShieldCheck size={16} className="shrink-0 text-white/60" />
    <span className="truncate text-[12px] font-bold uppercase tracking-[0.12em] text-white">
      Label
    </span>
  </div>
  <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-black/[0.12]">
    <ArrowRight
      size={16}
      className="text-white transition-transform group-hover/btn:translate-x-0.5"
      strokeWidth={2.25}
    />
  </div>
</button>
```

---

## Animations Framer Motion

```tsx
// Entrée de page avec stagger
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.08,
    },
  },
};

// Item individuel dans le stagger
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// Transition entre steps de formulaire
const formVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.3, ease: "easeIn" } },
};
```

---

## États de chargement — Skeleton Animations

### Philosophie

**Chaque page qui charge des éléments DOIT utiliser des skeletons animés** suivant la forme exacte du contenu finalisé.
Ne jamais afficher un simple texte "Chargement…" ou un spinner centré.

### Composant Skeleton

```tsx
// @/components/ui/skeleton.tsx
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-white/[0.06]", className)}
      {...props}
    />
  );
}
```

**Propriétés** :

- Animation native Tailwind : `animate-pulse`
- Couleur : `bg-white/[0.06]` (cohérent avec les overlays du design system)
- Arrondi par défaut : `rounded-xl` (overridable via className)

### Pattern — Skeleton Layout

La règle d'or : **Le skeleton doit avoir EXACTEMENT la forme du contenu finalisé.**

#### Exemple 1 : Liste de cartes (templates assessments)

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// État de chargement
{
  [1, 2, 3].map((i) => (
    <div
      key={i}
      className="bg-[#181818] rounded-xl px-5 py-4 flex items-center gap-4"
    >
      <Skeleton className="w-5 h-5 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
    </div>
  ));
}

// État finalisé ressemble à ceci
<div className="bg-[#181818] rounded-xl px-5 py-4 flex items-center gap-4">
  <FileText size={20} className="text-white/40 shrink-0" />{" "}
  {/* Remplace w-5 h-5 skeleton */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-white truncate">Template Name</span>
      <Star size={13} className="text-amber-500 fill-amber-500 shrink-0" />{" "}
      {/* Remplace w-16 skeleton */}
      <span className="text-[10px] bg-white/[0.04] rounded-full px-2 py-0.5 text-white/60">
        Type
      </span>
    </div>
    <p className="text-[12px] text-white/60">Description ici</p>{" "}
    {/* Remplace w-48 skeleton */}
  </div>
  <button className="h-8 w-8 flex items-center justify-center">…</button>{" "}
  {/* Remplace h-8 w-8 skeleton */}
</div>;
```

#### Exemple 2 : Grille de charts (dashboard métriques)

```tsx
{
  loading && (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-[#181818] rounded-2xl p-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-40 w-full rounded-lg mb-3" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// État finalisé
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="bg-[#181818] rounded-2xl p-4">
    <h3 className="text-[12px] font-semibold text-white mb-2">Métrique</h3>{" "}
    {/* Remplace h-6 w-32 */}
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>{/* Chart */}</LineChart>
    </ResponsiveContainer>
    <div className="flex items-center justify-between text-[10px] text-white/60">
      <span>
        Dernière: <strong>12.5 kg</strong>
      </span>{" "}
      {/* Remplace h-4 w-24 */}
      <span>3 mesures</span> {/* Remplace h-4 w-16 */}
    </div>
  </div>
</div>;
```

#### Exemple 3 : Formulaire / bloc unifié (template edit page)

```tsx
{
  loading && (
    <main className="min-h-screen bg-[#121212] font-sans">
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-[#181818] rounded-xl p-6 space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>

          {/* Modules skeleton */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/[0.02] rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
```

### Checklist Skeleton

Avant toute implémentation de loading state :

- ✅ Le container parent a `bg-[#121212]` (fond app)
- ✅ Les cartes de skeleton ont `bg-[#181818]` (surface bloc) ou `bg-white/[0.02]` (overlay)
- ✅ Chaque Skeleton a des dimensions exactes (h-x w-x) correspondant au contenu final
- ✅ Les arrondis (.rounded-xl, .rounded-lg, .rounded-full) correspondent au contenu
- ✅ Le layout (flexbox, grid) est identique à l'état finalisé
- ✅ Pas de texte "Chargement…" ou spinner centré — skeleton layout uniquement
- ✅ L'animation `animate-pulse` est automatique via le composant Skeleton

### Fichiers implémentant le pattern skeleton

- `app/coach/assessments/page.tsx` — Liste templates avec skeleton cards
- `app/coach/assessments/templates/[templateId]/edit/page.tsx` — Template edit page skeleton
- `components/assessments/dashboard/ClientMetricsDashboard.tsx` — Metrics grid skeleton
- `app/coach/clients/[clientId]/page.tsx` — Référence implémentation complète

---

## Icones

- Librairie : **Lucide React**
- `strokeWidth` par défaut : `1.5`
- `strokeWidth={1.75}` sur icones ≤ 13px (feature rows)
- `strokeWidth={2.25}` sur icone arrow dans CTA (besoin de lisibilité)
- Taille dans grille outils : `19px`
- Taille dans feature rows : `13px`
- Taille dans inputs : `16px`
- Taille dans boutons : `16–18px`

---

## Ce fichier fait foi

En cas de conflit entre ce document et un autre fichier de référence design (`DESIGN_SYSTEM_GENESIS.json`, anciens tokens, etc.), **ce fichier v2.0 prend le dessus**.

Les anciennes références (neumorphisme, fond crème `#F0EFE7`, jaune `#FCF76E`) sont obsolètes pour la page principale et le dashboard coach. Le DS v1.0 (Papier chaud) s'appliquait à une direction abandonnée.
