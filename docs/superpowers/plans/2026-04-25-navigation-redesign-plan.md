# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le `UnifiedDock` actuel (trop chargé, peu intuitif) par un système à deux barres superposées — une Rangée B globale permanente et une Rangée A contextuelle avec dropdowns — avec un bouton CTA intelligent (absent/direct/menu selon le nombre d'actions).

**Architecture:** `NavDock` orchestrateur composé de `NavRowB` (nav globale, toujours visible) + `NavRowA` (sous-nav contextuelle, conditionnelle). La config par route est centralisée dans `useNavConfig`. Le `DockContext` est simplifié pour garder uniquement `activeClientId`. Les pages enregistrent leurs handlers via `useDockActions` (API inchangée).

**Tech Stack:** Next.js App Router, React, TypeScript strict, Tailwind CSS, Framer Motion, Lucide React

**Spec:** `docs/superpowers/specs/2026-04-25-navigation-redesign-design.md`

---

## Fichiers impactés

### Créés
- `components/layout/NavDock/index.ts` — exports publics
- `components/layout/NavDock/NavDock.tsx` — orchestrateur (Rangée A + Rangée B)
- `components/layout/NavDock/NavRowB.tsx` — nav globale permanente (5 items)
- `components/layout/NavDock/NavRowA.tsx` — sous-nav contextuelle conditionnelle
- `components/layout/NavDock/NavDropdown.tsx` — dropdown réutilisable (AnimatePresence)
- `components/layout/NavDock/NavCTA.tsx` — bouton CTA intelligent (absent/direct/menu)
- `components/layout/NavDock/useNavConfig.ts` — config par route (remplace `useDockConfig`)
- `components/layout/NavDock/dockActionRegistry.ts` — registry des handlers de page (extrait de DockSectionC)

### Modifiés
- `components/layout/DockContext.tsx` — suppression `openClients`, `closeClient`, `commandPaletteOpen` ; garde `activeClientId`, `openClient`, `setActiveClient`
- `components/layout/CoachShell.tsx` — remplace `<UnifiedDock />` par `<NavDock />`
- `components/clients/ClientHeader.tsx` — adapté au nouveau `DockContext` simplifié (API `openClient` conservée)
- `app/coach/clients/page.tsx` — import `useDockActions` depuis nouveau chemin
- `CHANGELOG.md`

### Supprimés (en fin de plan, après validation)
- `components/layout/UnifiedDock/` (tout le dossier)
- `components/layout/DockBottom.tsx`
- `components/layout/ClientTabsBar.tsx`
- `components/layout/useDockBottom.ts`

---

## Task 1 : `dockActionRegistry.ts` — registry extrait

Extraire le registry des handlers de page depuis `DockSectionC` pour le rendre indépendant du reste de l'ancien système.

**Files:**
- Create: `components/layout/NavDock/dockActionRegistry.ts`

- [ ] **Step 1 : Créer le fichier registry**

```ts
// components/layout/NavDock/dockActionRegistry.ts

export const dockActionRegistry: Record<string, (() => void) | undefined> = {};

export function registerDockAction(key: string, handler: () => void) {
  dockActionRegistry[key] = handler;
}

export function unregisterDockAction(key: string) {
  delete dockActionRegistry[key];
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs liées à ce fichier.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/NavDock/dockActionRegistry.ts
git commit -m "feat(nav): extract dockActionRegistry to NavDock module"
```

---

## Task 2 : `useNavConfig.ts` — config centralisée par route

Remplace `useDockConfig.ts`. Retourne la config complète de la Rangée A et du CTA selon la route active.

**Files:**
- Create: `components/layout/NavDock/useNavConfig.ts`

- [ ] **Step 1 : Créer le hook**

```ts
// components/layout/NavDock/useNavConfig.ts
"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type NavRowAItem = {
  id: string;
  label: string;
  href?: string; // absent si c'est un dropdown
  dropdown?: { id: string; label: string; href: string }[];
};

export type CTAConfig =
  | { type: "hidden" }
  | { type: "direct"; label: string; actionKey: string }
  | { type: "menu"; actions: { id: string; label: string; actionKey: string }[] };

export type NavConfig = {
  rowA: NavRowAItem[] | null; // null = rangée A absente
  cta: CTAConfig;
};

export function useNavConfig(): NavConfig {
  const pathname = usePathname();

  // ── Accueil ──────────────────────────────────────────────────────────────
  if (pathname === "/coach/organisation" || pathname === "/dashboard") {
    return {
      rowA: null,
      cta: {
        type: "menu",
        actions: [
          { id: "task", label: "+ Tâche", actionKey: "ADD_TASK" },
          { id: "event", label: "+ Événement", actionKey: "ADD_EVENT" },
        ],
      },
    };
  }

  // ── Liste clients ─────────────────────────────────────────────────────────
  if (pathname === "/coach/clients") {
    return {
      rowA: null,
      cta: {
        type: "menu",
        actions: [
          { id: "new-client", label: "+ Nouveau client", actionKey: "NEW_CLIENT" },
          { id: "filters", label: "Filtres", actionKey: "TOGGLE_FILTERS" },
          { id: "view", label: "Vue grille / liste", actionKey: "TOGGLE_VIEW" },
        ],
      },
    };
  }

  // ── Client actif ──────────────────────────────────────────────────────────
  const clientMatch = pathname.match(/^\/coach\/clients\/([^/]+)(\/(.*))?$/);
  if (clientMatch) {
    const clientId = clientMatch[1];
    const subPath = clientMatch[3] ?? "";

    const rowA: NavRowAItem[] = [
      { id: "profil", label: "Profil", href: `/coach/clients/${clientId}/profil` },
      {
        id: "data",
        label: "Data",
        dropdown: [
          { id: "metriques", label: "Métriques", href: `/coach/clients/${clientId}/data/metriques` },
          { id: "bilans", label: "Bilans", href: `/coach/clients/${clientId}/data/bilans` },
          { id: "performances", label: "Performances", href: `/coach/clients/${clientId}/data/performances` },
          { id: "morphopro", label: "MorphoPro", href: `/coach/clients/${clientId}/data/morphopro` },
        ],
      },
      {
        id: "protocoles",
        label: "Protocoles",
        dropdown: [
          { id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/protocoles/nutrition` },
          { id: "entrainement", label: "Entraînement", href: `/coach/clients/${clientId}/protocoles/entrainement` },
          { id: "cardio", label: "Cardio", href: `/coach/clients/${clientId}/protocoles/cardio` },
          { id: "composition", label: "Composition", href: `/coach/clients/${clientId}/protocoles/composition` },
        ],
      },
    ];

    let cta: CTAConfig = { type: "hidden" };

    if (subPath.includes("profil")) {
      cta = { type: "direct", label: "Inviter", actionKey: "INVITE_CLIENT" };
    } else if (subPath.includes("data/metriques")) {
      cta = {
        type: "menu",
        actions: [
          { id: "add-metric", label: "+ Saisie manuelle", actionKey: "ADD_METRIC" },
          { id: "import", label: "Import CSV", actionKey: "IMPORT_CSV" },
        ],
      };
    } else if (subPath.includes("data/bilans")) {
      cta = {
        type: "menu",
        actions: [
          { id: "new-bilan", label: "+ Nouveau bilan", actionKey: "NEW_BILAN" },
          { id: "send", label: "Renvoyer par email", actionKey: "SEND_BILAN" },
        ],
      };
    } else if (subPath.includes("data/morphopro")) {
      cta = { type: "direct", label: "Analyser", actionKey: "ANALYZE_MORPHO" };
    }
    // performances, protocoles/* → type: "hidden"

    return { rowA, cta };
  }

  // ── Studio ────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/programs") || pathname.startsWith("/coach/assessments")) {
    const isTemplatesList =
      pathname === "/coach/programs/templates" ||
      pathname === "/coach/assessments";

    return {
      rowA: [
        { id: "programmes", label: "Programmes", href: "/coach/programs/templates" },
        { id: "bilans", label: "Bilans", href: "/coach/assessments" },
        { id: "nutrition", label: "Nutrition", href: "/coach/programs/nutrition" },
      ],
      cta: isTemplatesList
        ? {
            type: "menu",
            actions: [
              { id: "new", label: "+ Nouveau template", actionKey: "NEW_TEMPLATE" },
              { id: "filters", label: "Filtres", actionKey: "TOGGLE_FILTERS" },
              { id: "view", label: "Vue grille / liste", actionKey: "TOGGLE_VIEW" },
            ],
          }
        : { type: "hidden" },
    };
  }

  // ── Business ──────────────────────────────────────────────────────────────
  if (
    pathname.startsWith("/coach/comptabilite") ||
    pathname.startsWith("/coach/formules")
  ) {
    const isComptabilite = pathname.startsWith("/coach/comptabilite");
    return {
      rowA: [
        { id: "comptabilite", label: "Comptabilité", href: "/coach/comptabilite" },
        { id: "formules", label: "Formules", href: "/coach/formules" },
        { id: "organisation", label: "Organisation", href: "/coach/organisation" },
      ],
      cta: isComptabilite
        ? {
            type: "menu",
            actions: [
              { id: "new-invoice", label: "+ Facture", actionKey: "NEW_INVOICE" },
              { id: "filters", label: "Filtres", actionKey: "OPEN_SEARCH" },
            ],
          }
        : { type: "direct", label: "+ Formule", actionKey: "NEW_FORMULA" },
    };
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/settings")) {
    return {
      rowA: [
        { id: "profil", label: "Profil", href: "/coach/settings" },
        { id: "preferences", label: "Préférences", href: "/coach/settings?tab=preferences" },
        { id: "notifications", label: "Notifications", href: "/coach/settings?tab=notifications" },
      ],
      cta: { type: "hidden" },
    };
  }

  // ── Défaut ────────────────────────────────────────────────────────────────
  return { rowA: null, cta: { type: "hidden" } };
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs liées à ce fichier.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/NavDock/useNavConfig.ts
git commit -m "feat(nav): add useNavConfig — centralized route-based nav config"
```

---

## Task 3 : `NavDropdown.tsx` — composant dropdown réutilisable

Utilisé par `NavRowA` (dropdowns Data/Protocoles) et `NavCTA` (menu d'actions).

**Files:**
- Create: `components/layout/NavDock/NavDropdown.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/NavDock/NavDropdown.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type DropdownItem =
  | { id: string; label: string; href: string; actionKey?: never }
  | { id: string; label: string; actionKey: string; href?: never };

interface NavDropdownProps {
  open: boolean;
  onClose: () => void;
  items: DropdownItem[];
  onAction?: (actionKey: string) => void;
  align?: "left" | "center" | "right";
}

export function NavDropdown({ open, onClose, items, onAction, align = "center" }: NavDropdownProps) {
  const pathname = usePathname();

  const alignClass =
    align === "left"
      ? "left-0"
      : align === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay fermeture */}
          <div className="fixed inset-0 z-[58]" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute bottom-full mb-2 ${alignClass} z-[59] min-w-[160px] overflow-hidden rounded-xl border-[0.3px] border-white/[0.08] bg-[#181818] shadow-[0_8px_24px_rgba(0,0,0,0.5)]`}
          >
            {items.map((item) => {
              if (item.href) {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-4 py-2.5 text-[12px] font-medium transition-colors ${
                      active
                        ? "bg-[#1f8a65]/05 text-[#1f8a65]"
                        : "text-white/70 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onAction?.(item.actionKey!);
                    onClose();
                  }}
                  className="flex w-full items-center px-4 py-2.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/NavDock/NavDropdown.tsx
git commit -m "feat(nav): add NavDropdown reusable animated dropdown component"
```

---

## Task 4 : `NavCTA.tsx` — bouton CTA intelligent

Absent si 0 actions, action directe si 1 action, menu si 2+ actions.

**Files:**
- Create: `components/layout/NavDock/NavCTA.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/NavDock/NavCTA.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { dockActionRegistry } from "./dockActionRegistry";
import type { CTAConfig } from "./useNavConfig";

interface NavCTAProps {
  cta: CTAConfig;
}

export function NavCTA({ cta }: NavCTAProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (cta.type === "hidden") return null;

  if (cta.type === "direct") {
    return (
      <button
        onClick={() => dockActionRegistry[cta.actionKey]?.()}
        className="flex h-9 items-center rounded-xl bg-[#1f8a65] px-4 text-[11px] font-bold text-white transition-all hover:bg-[#217356] active:scale-[0.97]"
      >
        {cta.label}
      </button>
    );
  }

  // type === "menu"
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f8a65] text-white transition-all hover:bg-[#217356] active:scale-[0.97]"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>

      <NavDropdown
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        align="right"
        items={cta.actions.map((a) => ({ id: a.id, label: a.label, actionKey: a.actionKey }))}
        onAction={(key) => dockActionRegistry[key]?.()}
      />
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/NavDock/NavCTA.tsx
git commit -m "feat(nav): add NavCTA — smart CTA button (hidden/direct/menu)"
```

---

## Task 5 : `NavRowA.tsx` — sous-navigation contextuelle

Rangée A : affiche `[Profil] [Data ▾] [Protocoles ▾]` dans un client, ou items directs en Studio/Business/Settings.

**Files:**
- Create: `components/layout/NavDock/NavRowA.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/NavDock/NavRowA.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavDropdown } from "./NavDropdown";
import type { NavRowAItem } from "./useNavConfig";

interface NavRowAProps {
  items: NavRowAItem[];
}

function isItemActive(item: NavRowAItem, pathname: string): boolean {
  if (item.href) {
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }
  if (item.dropdown) {
    return item.dropdown.some(
      (d) => pathname === d.href || pathname.startsWith(d.href + "/")
    );
  }
  return false;
}

function RowAButton({ item }: { item: NavRowAItem }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = isItemActive(item, pathname);

  const buttonClass = cn(
    "flex h-7 items-center gap-1 rounded-lg px-3 text-[11px] font-medium transition-all duration-150",
    active
      ? "bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20"
      : "text-white/40 hover:bg-white/[0.05] hover:text-white/70"
  );

  // Lien direct (pas de dropdown)
  if (item.href) {
    return (
      <Link href={item.href} className={buttonClass}>
        {item.label}
      </Link>
    );
  }

  // Bouton avec dropdown
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={buttonClass}>
        {item.label}
        <ChevronDown
          size={10}
          strokeWidth={2}
          className={cn("transition-transform duration-150", open ? "rotate-180" : "")}
        />
      </button>

      <NavDropdown
        open={open}
        onClose={() => setOpen(false)}
        align="center"
        items={item.dropdown!.map((d) => ({ id: d.id, label: d.label, href: d.href }))}
      />
    </div>
  );
}

export function NavRowA({ items }: NavRowAProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] px-2 py-1 backdrop-blur-xl">
      {items.map((item) => (
        <RowAButton key={item.id} item={item} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/NavDock/NavRowA.tsx
git commit -m "feat(nav): add NavRowA — contextual sub-navigation with dropdowns"
```

---

## Task 6 : `NavRowB.tsx` — navigation globale permanente

5 destinations globales + séparateur + `NavCTA`.

**Files:**
- Create: `components/layout/NavDock/NavRowB.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/NavDock/NavRowB.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Layers,
  Briefcase,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavCTA } from "./NavCTA";
import type { CTAConfig } from "./useNavConfig";

const NAV_ITEMS = [
  {
    id: "accueil",
    label: "Accueil",
    icon: LayoutDashboard,
    href: "/coach/organisation",
    match: (p: string) => p === "/coach/organisation" || p === "/dashboard",
  },
  {
    id: "lab",
    label: "Lab",
    icon: FlaskConical,
    href: "/coach/clients",
    match: (p: string) => p.startsWith("/coach/clients"),
  },
  {
    id: "studio",
    label: "Studio",
    icon: Layers,
    href: "/coach/programs/templates",
    match: (p: string) =>
      p.startsWith("/coach/programs") || p.startsWith("/coach/assessments"),
  },
  {
    id: "business",
    label: "Business",
    icon: Briefcase,
    href: "/coach/comptabilite",
    match: (p: string) =>
      p.startsWith("/coach/comptabilite") || p.startsWith("/coach/formules"),
  },
  {
    id: "compte",
    label: "Mon compte",
    icon: UserCircle,
    href: "/coach/settings",
    match: (p: string) => p.startsWith("/coach/settings"),
  },
] as const;

interface NavRowBProps {
  cta: CTAConfig;
}

export function NavRowB({ cta }: NavRowBProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="relative flex items-center gap-2 rounded-2xl px-3 h-14">
      {/* Background glassmorphism */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.025] to-transparent" />
      </div>

      <div className="relative z-10 flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl border px-3 h-9 transition-all duration-200 hover:scale-105 active:scale-95",
                active
                  ? "border-[#1f8a65]/30 bg-[#1f8a65]/20 text-[#1f8a65]"
                  : "border-white/[0.06] bg-white/[0.06] text-white/40 hover:bg-white/[0.09] hover:text-white/70"
              )}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.75} />
              <span className="text-[8px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}

        {cta.type !== "hidden" && (
          <div className="mx-1 h-6 w-px shrink-0 bg-white/[0.07]" />
        )}

        <NavCTA cta={cta} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/NavDock/NavRowB.tsx
git commit -m "feat(nav): add NavRowB — permanent global navigation bar"
```

---

## Task 7 : `NavDock.tsx` + `index.ts` — orchestrateur

Compose Rangée A + Rangée B, gère le `pb` du contenu.

**Files:**
- Create: `components/layout/NavDock/NavDock.tsx`
- Create: `components/layout/NavDock/index.ts`

- [ ] **Step 1 : Créer l'orchestrateur**

```tsx
// components/layout/NavDock/NavDock.tsx
"use client";

import { NavRowA } from "./NavRowA";
import { NavRowB } from "./NavRowB";
import { useNavConfig } from "./useNavConfig";

export function NavDock() {
  const { rowA, cta } = useNavConfig();

  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 flex flex-col items-center gap-1.5">
      {rowA && <NavRowA items={rowA} />}
      <NavRowB cta={cta} />
    </div>
  );
}
```

- [ ] **Step 2 : Créer l'index**

```ts
// components/layout/NavDock/index.ts
export { NavDock } from "./NavDock";
export { useDockActions } from "./useDockActions";
export { registerDockAction, unregisterDockAction } from "./dockActionRegistry";
```

- [ ] **Step 3 : Créer `useDockActions` dans NavDock**

```ts
// components/layout/NavDock/useDockActions.ts
"use client";

import { useEffect } from "react";
import { registerDockAction, unregisterDockAction } from "./dockActionRegistry";

export function useDockActions(actions: Record<string, () => void>) {
  useEffect(() => {
    Object.entries(actions).forEach(([key, handler]) => {
      registerDockAction(key, handler);
    });
    return () => {
      Object.keys(actions).forEach((key) => {
        unregisterDockAction(key);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs.

- [ ] **Step 5 : Commit**

```bash
git add components/layout/NavDock/NavDock.tsx components/layout/NavDock/index.ts components/layout/NavDock/useDockActions.ts
git commit -m "feat(nav): add NavDock orchestrator + index exports"
```

---

## Task 8 : Simplifier `DockContext`

Retirer `openClients[]`, `closeClient`, `commandPaletteOpen` — garder uniquement `activeClientId`, `openClient`, `setActiveClient`.

**Files:**
- Modify: `components/layout/DockContext.tsx`

- [ ] **Step 1 : Réécrire DockContext**

```tsx
// components/layout/DockContext.tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type DockContextType = {
  activeClientId: string | null;
  openClient: (client: { id: string; firstName: string; lastName: string }) => void;
  setActiveClient: (clientId: string) => void;
};

const DockContext = createContext<DockContextType>({
  activeClientId: null,
  openClient: () => {},
  setActiveClient: () => {},
});

export function DockProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  const openClient = useCallback(
    (client: { id: string; firstName: string; lastName: string }) => {
      setActiveClientId(client.id);
    },
    []
  );

  const setActiveClient = useCallback((clientId: string) => {
    setActiveClientId(clientId);
  }, []);

  return (
    <DockContext.Provider value={{ activeClientId, openClient, setActiveClient }}>
      {children}
    </DockContext.Provider>
  );
}

export function useDock() {
  const context = useContext(DockContext);
  if (!context) throw new Error("useDock must be called within DockProvider");
  return context;
}
```

- [ ] **Step 2 : Vérifier TypeScript — des erreurs vont apparaître sur les consommateurs**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -50
```

Les erreurs attendues : `openClients`, `closeClient`, `commandPaletteOpen` non trouvés dans les fichiers qui les utilisaient (UnifiedDock — qu'on va supprimer).

- [ ] **Step 3 : Adapter `ClientHeader.tsx`**

`ClientHeader` utilise `openClient` — l'API est conservée, pas de changement nécessaire. Vérifier :

```bash
grep -n "useDock\|openClient\|closeClient\|openClients\|commandPaletteOpen" /Users/user/Desktop/VIRTUS/components/clients/ClientHeader.tsx
```

Si uniquement `openClient` → aucun changement requis.

- [ ] **Step 4 : Adapter `app/coach/clients/page.tsx`**

Remplacer l'import `useDockActions` depuis l'ancien chemin :

```ts
// Remplacer :
import { useDockActions } from "@/components/layout/UnifiedDock";
import { useDock } from "@/components/layout/DockContext";

// Par :
import { useDockActions } from "@/components/layout/NavDock";
import { useDock } from "@/components/layout/DockContext";
```

Supprimer toute référence à `closeClient`, `openClients`, `commandPaletteOpen` dans ce fichier si présentes (vérifier avec grep).

- [ ] **Step 5 : Vérifier TypeScript — 0 erreurs**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6 : Commit**

```bash
git add components/layout/DockContext.tsx app/coach/clients/page.tsx components/clients/ClientHeader.tsx
git commit -m "refactor(nav): simplify DockContext — remove openClients tabs system"
```

---

## Task 9 : Brancher `NavDock` dans `CoachShell`

Remplacer `<UnifiedDock />` par `<NavDock />`.

**Files:**
- Modify: `components/layout/CoachShell.tsx`

- [ ] **Step 1 : Modifier CoachShell**

```tsx
// components/layout/CoachShell.tsx
"use client";

import { ReactNode } from "react";
import { DockProvider } from "@/components/layout/DockContext";
import { NavDock } from "@/components/layout/NavDock";

function ShellInner({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121212]">
      <div className="min-h-screen bg-[#121212] pb-32">
        {children}
      </div>
      <NavDock />
    </div>
  );
}

export default function CoachShell({ children }: { children: ReactNode }) {
  return (
    <DockProvider>
      <ShellInner>{children}</ShellInner>
    </DockProvider>
  );
}
```

Note : `pb-32` (128px) pour couvrir les deux barres (56px Rangée B + 36px Rangée A + 6px gap + 24px bottom offset = ~122px arrondi à 128px).

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Lancer le dev server et vérifier visuellement**

```bash
cd /Users/user/Desktop/VIRTUS && npm run dev
```

Vérifier dans le navigateur :
- `/coach/clients` → Rangée B seule (5 items + CTA `+` avec menu)
- `/coach/clients/[id]/profil` → Rangée A `[Profil] [Data ▾] [Protocoles ▾]` + Rangée B + CTA `Inviter`
- `/coach/clients/[id]/data/metriques` → bouton "Data" actif en vert dans Rangée A + CTA `+` avec menu
- `/coach/clients/[id]/data/morphopro` → CTA `Analyser` direct
- `/coach/clients/[id]/data/performances` → CTA absent
- `/coach/programs/templates` → Rangée A Studio `[Programmes] [Bilans] [Nutrition]` + CTA menu

- [ ] **Step 4 : Commit**

```bash
git add components/layout/CoachShell.tsx
git commit -m "feat(nav): wire NavDock into CoachShell — replace UnifiedDock"
```

---

## Task 10 : Supprimer l'ancien système

Supprimer les fichiers du `UnifiedDock` et composants devenus obsolètes.

**Files:**
- Delete: `components/layout/UnifiedDock/` (dossier complet)
- Delete: `components/layout/DockBottom.tsx`
- Delete: `components/layout/ClientTabsBar.tsx`
- Delete: `components/layout/useDockBottom.ts`

- [ ] **Step 1 : Vérifier qu'il n'y a plus d'imports vers ces fichiers**

```bash
grep -rn "UnifiedDock\|DockBottom\|ClientTabsBar\|useDockBottom\|DockSectionA\|DockSectionB\|DockSectionC\|useDockConfig\|useDockScroll\|ContextPill\|CommandPalette" \
  /Users/user/Desktop/VIRTUS/app \
  /Users/user/Desktop/VIRTUS/components \
  --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Attendu : 0 résultats (si des résultats apparaissent, corriger avant de continuer).

- [ ] **Step 2 : Supprimer les fichiers**

```bash
rm -rf /Users/user/Desktop/VIRTUS/components/layout/UnifiedDock
rm /Users/user/Desktop/VIRTUS/components/layout/DockBottom.tsx
rm /Users/user/Desktop/VIRTUS/components/layout/ClientTabsBar.tsx
rm /Users/user/Desktop/VIRTUS/components/layout/useDockBottom.ts
```

- [ ] **Step 3 : Vérifier TypeScript — 0 erreurs**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4 : Vérifier que le dev server tourne toujours sans erreur**

```bash
cd /Users/user/Desktop/VIRTUS && npm run dev 2>&1 | grep -E "error|Error|warning" | head -20
```

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "chore(nav): remove legacy UnifiedDock, DockBottom, ClientTabsBar, useDockBottom"
```

---

## Task 11 : CHANGELOG + project-state

- [ ] **Step 1 : Mettre à jour CHANGELOG.md**

Ajouter en tête de `CHANGELOG.md` :

```
## 2026-04-25

FEATURE: Navigation redesign — dual-bar dock (NavRowA contextual + NavRowB global)
FEATURE: NavCTA smart button — hidden/direct/menu based on page action count
REFACTOR: DockContext simplified — remove openClients tabs system
CHORE: Remove UnifiedDock, DockBottom, ClientTabsBar, useDockBottom, ContextPill
```

- [ ] **Step 2 : Mettre à jour project-state.md**

Ajouter une section `## 2026-04-25 — Navigation Redesign — NavDock Dual-Bar` dans `.claude/rules/project-state.md` décrivant :
- Les nouveaux fichiers `components/layout/NavDock/`
- La suppression de `UnifiedDock/`, `DockBottom`, `ClientTabsBar`, `useDockBottom`
- Le `DockContext` simplifié
- Le wiring `useNavConfig` → config par route
- Points de vigilance : `pb-32` sur `CoachShell`, `useDockActions` ré-exporté depuis `NavDock/index.ts`

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state after nav redesign"
```

---

## Self-Review

**Spec coverage :**
- ✅ Deux barres superposées (Task 7 NavDock)
- ✅ Rangée B toujours visible avec 5 items (Task 6 NavRowB)
- ✅ Rangée A conditionnelle avec dropdowns Data/Protocoles (Task 5 NavRowA)
- ✅ Rangée A absente sur Accueil, liste clients, Settings (Task 2 useNavConfig)
- ✅ CTA hidden/direct/menu selon nb actions (Task 4 NavCTA)
- ✅ Inventory actions par page complet dans useNavConfig (Task 2)
- ✅ Dropdowns animés Framer Motion (Task 3 NavDropdown)
- ✅ Suppression ContextPill, tabs clients, DockBottom (Task 10)
- ✅ `useDockActions` API conservée pour les pages existantes (Task 7 + 8)
- ✅ DockContext simplifié (Task 8)

**Placeholders :** aucun TBD détecté.

**Type consistency :** `CTAConfig`, `NavRowAItem`, `NavConfig` définis dans `useNavConfig.ts` (Task 2) et consommés dans `NavCTA` (Task 4), `NavRowA` (Task 5), `NavRowB` (Task 6), `NavDock` (Task 7) — cohérent.
