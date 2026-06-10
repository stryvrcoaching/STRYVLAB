# UX Redesign — Phase 1 : Double Dock Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le CoachShell actuel (sidebar 200px) par un double dock — dock gauche vertical permanent (48px) + dock bas horizontal centré et contextuel — sans régression sur les pages existantes.

**Architecture:** Le `CoachShell` existant est refactorisé en 3 composants distincts : `DockLeft` (navigation globale, permanent), `DockBottom` (navigation contextuelle, centré, configurable), et `ClientTabsBar` (tabs clients ouverts, au-dessus du dock bas, Lab uniquement). Le `TopBarContext` existant est conservé tel quel. Chaque page continue d'injecter son contenu via `useSetTopBar`.

**Tech Stack:** Next.js App Router, TypeScript strict, Framer Motion, Tailwind CSS, Lucide React, Supabase (pour persistance config dock), localStorage (fallback config dock)

**Spec:** `docs/superpowers/specs/2026-04-19-ux-redesign-navigation-lab.md`

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `components/layout/CoachShell.tsx` | Modifier | Shell principal — intègre DockLeft + DockBottom + TopBar |
| `components/layout/DockLeft.tsx` | Créer | Dock gauche vertical permanent, 5 entrées fixes |
| `components/layout/DockBottom.tsx` | Créer | Dock bas horizontal centré, contextuel, configurable, bouton + |
| `components/layout/ClientTabsBar.tsx` | Créer | Barre de tabs clients ouverts (Lab uniquement) |
| `components/layout/DockContext.tsx` | Créer | Context React — dock config + tabs clients ouverts |
| `components/layout/useDockBottom.ts` | Créer | Hook — retourne les items du dock bas selon pathname |
| `components/layout/TopBarContext.tsx` | Inchangé | Conservé tel quel |
| `components/layout/useSetTopBar.tsx` | Inchangé | Conservé tel quel |
| `app/coach/layout.tsx` | Modifier | Wrap avec DockProvider |

---

## Task 1 : DockContext — state global navigation

**Files:**
- Create: `components/layout/DockContext.tsx`

- [ ] **Step 1 : Créer le context**

```tsx
// components/layout/DockContext.tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type OpenClient = {
  id: string;
  firstName: string;
  lastName: string;
};

type DockContextType = {
  openClients: OpenClient[];
  activeClientId: string | null;
  openClient: (client: OpenClient) => void;
  closeClient: (clientId: string) => void;
  setActiveClient: (clientId: string) => void;
};

const DockContext = createContext<DockContextType>({
  openClients: [],
  activeClientId: null,
  openClient: () => {},
  closeClient: () => {},
  setActiveClient: () => {},
});

export function DockProvider({ children }: { children: ReactNode }) {
  const [openClients, setOpenClients] = useState<OpenClient[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  const openClient = useCallback((client: OpenClient) => {
    setOpenClients((prev) => {
      if (prev.find((c) => c.id === client.id)) return prev;
      return [...prev, client];
    });
    setActiveClientId(client.id);
  }, []);

  const closeClient = useCallback((clientId: string) => {
    setOpenClients((prev) => {
      const next = prev.filter((c) => c.id !== clientId);
      return next;
    });
    setActiveClientId((prev) => {
      if (prev !== clientId) return prev;
      return null;
    });
  }, []);

  const setActiveClient = useCallback((clientId: string) => {
    setActiveClientId(clientId);
  }, []);

  return (
    <DockContext.Provider value={{ openClients, activeClientId, openClient, closeClient, setActiveClient }}>
      {children}
    </DockContext.Provider>
  );
}

export function useDock() {
  return useContext(DockContext);
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/DockContext.tsx
git commit -m "feat(shell): add DockContext for open clients and active client state"
```

---

## Task 2 : useDockBottom — items contextuels selon pathname

**Files:**
- Create: `components/layout/useDockBottom.ts`

- [ ] **Step 1 : Créer le hook**

```ts
// components/layout/useDockBottom.ts
"use client";

import { usePathname } from "next/navigation";
import {
  BarChart2,
  ClipboardList,
  TrendingUp,
  Scan,
  Utensils,
  Dumbbell,
  HeartPulse,
  BarChart3,
  CreditCard,
  Euro,
  Activity,
  Layers,
  ClipboardCheck,
  Salad,
  UserCircle,
  Bell,
  Settings,
} from "lucide-react";

export type DockBottomItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

export function useDockBottom(): DockBottomItem[] {
  const pathname = usePathname();

  // Lab — Data & Analyse (client ouvert)
  if (pathname.includes("/lab/") && pathname.includes("/data")) {
    return [
      { id: "metriques", label: "Métriques", href: "", icon: BarChart2 },
      { id: "bilans", label: "Bilans", href: "", icon: ClipboardList },
      { id: "performances", label: "Performances", href: "", icon: TrendingUp },
      { id: "morphopro", label: "MorphoPro", href: "", icon: Scan },
    ];
  }

  // Lab — Protocoles (client ouvert)
  if (pathname.includes("/lab/") && pathname.includes("/protocoles")) {
    return [
      { id: "nutrition", label: "Nutrition", href: "", icon: Utensils },
      { id: "entrainement", label: "Entraînement", href: "", icon: Dumbbell },
      { id: "cardio", label: "Cardio", href: "", icon: HeartPulse },
      { id: "composition", label: "Composition", href: "", icon: BarChart3 },
    ];
  }

  // Business
  if (pathname.startsWith("/coach/business") || pathname.startsWith("/coach/comptabilite") || pathname.startsWith("/coach/formules") || pathname.startsWith("/coach/organisation")) {
    return [
      { id: "comptabilite", label: "Comptabilité", href: "/coach/comptabilite", icon: Euro },
      { id: "formules", label: "Formules", href: "/coach/formules", icon: CreditCard },
      { id: "organisation", label: "Organisation", href: "/coach/organisation", icon: Activity },
    ];
  }

  // Templates
  if (pathname.startsWith("/coach/programs") || pathname.startsWith("/coach/assessments")) {
    return [
      { id: "programmes", label: "Programmes", href: "/coach/programs/templates", icon: Dumbbell },
      { id: "bilans", label: "Bilans", href: "/coach/assessments", icon: ClipboardCheck },
      { id: "nutrition", label: "Nutrition", href: "#", icon: Salad },
    ];
  }

  // Mon compte
  if (pathname.startsWith("/coach/settings")) {
    return [
      { id: "profil", label: "Profil", href: "/coach/settings", icon: UserCircle },
      { id: "preferences", label: "Préférences", href: "/coach/settings#preferences", icon: Settings },
      { id: "notifications", label: "Notifications", href: "/coach/settings#notifications", icon: Bell },
    ];
  }

  // Dashboard et autres — pas de dock bas
  return [];
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/useDockBottom.ts
git commit -m "feat(shell): add useDockBottom hook — contextual dock items per pathname"
```

---

## Task 3 : DockLeft — dock gauche vertical permanent

**Files:**
- Create: `components/layout/DockLeft.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/DockLeft.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Layers,
  Briefcase,
  UserCircle,
} from "lucide-react";

const DOCK_LEFT_ITEMS = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    match: (p: string) => p === "/dashboard",
  },
  {
    id: "lab",
    icon: FlaskConical,
    label: "Lab",
    href: "/coach/clients",
    match: (p: string) => p.startsWith("/coach/clients") || p.startsWith("/lab"),
  },
  {
    id: "templates",
    icon: Layers,
    label: "Templates",
    href: "/coach/programs/templates",
    match: (p: string) => p.startsWith("/coach/programs") || p.startsWith("/coach/assessments"),
  },
  {
    id: "business",
    icon: Briefcase,
    label: "Business",
    href: "/coach/comptabilite",
    match: (p: string) =>
      p.startsWith("/coach/comptabilite") ||
      p.startsWith("/coach/formules") ||
      p.startsWith("/coach/organisation"),
  },
  {
    id: "compte",
    icon: UserCircle,
    label: "Mon compte",
    href: "/coach/settings",
    match: (p: string) => p.startsWith("/coach/settings"),
  },
] as const;

export default function DockLeft() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-2 py-3">
      {DOCK_LEFT_ITEMS.map(({ id, icon: Icon, label, href, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={id}
            href={href}
            title={label}
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 group ${
              active
                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.75} />
            {/* Indicateur actif */}
            {active && (
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#1f8a65]" />
            )}
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#0f0f0f] border-[0.3px] border-white/[0.06] rounded-lg text-[11px] font-medium text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
              {label}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/DockLeft.tsx
git commit -m "feat(shell): add DockLeft — permanent vertical dock with 5 global entries"
```

---

## Task 4 : ClientTabsBar — barre de tabs clients ouverts

**Files:**
- Create: `components/layout/ClientTabsBar.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/ClientTabsBar.tsx
"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useDock } from "@/components/layout/DockContext";

export default function ClientTabsBar() {
  const { openClients, activeClientId, closeClient, setActiveClient } = useDock();
  const router = useRouter();

  if (openClients.length === 0) return null;

  function handleSelect(clientId: string) {
    setActiveClient(clientId);
    router.push(`/coach/clients/${clientId}`);
  }

  function handleClose(e: React.MouseEvent, clientId: string) {
    e.stopPropagation();
    closeClient(clientId);
    if (activeClientId === clientId) {
      router.push("/coach/clients");
    }
  }

  return (
    <div className="flex items-center gap-1 px-2 overflow-x-auto no-scrollbar max-w-[640px]">
      {openClients.map((client) => {
        const active = client.id === activeClientId;
        const initials = `${client.firstName[0]}${client.lastName[0]}`.toUpperCase();
        return (
          <button
            key={client.id}
            onClick={() => handleSelect(client.id)}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all duration-150 shrink-0 ${
              active
                ? "bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20"
                : "bg-white/[0.04] text-white/50 border-[0.3px] border-white/[0.06] hover:text-white/80 hover:bg-white/[0.06]"
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${active ? "bg-[#1f8a65]/20 text-[#1f8a65]" : "bg-white/[0.08] text-white/40"}`}>
              {initials}
            </span>
            <span>{client.firstName}</span>
            <span
              role="button"
              onClick={(e) => handleClose(e, client.id)}
              className="ml-0.5 text-white/30 hover:text-white/70 transition-colors"
            >
              <X size={10} strokeWidth={2} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/ClientTabsBar.tsx
git commit -m "feat(shell): add ClientTabsBar — scrollable open client tabs above bottom dock"
```

---

## Task 5 : DockBottom — dock bas contextuel avec bouton +

**Files:**
- Create: `components/layout/DockBottom.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/layout/DockBottom.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDockBottom } from "@/components/layout/useDockBottom";
import ClientTabsBar from "@/components/layout/ClientTabsBar";

// Actions contextuelles du bouton +
function usePlusActions(): { label: string; href?: string; onClick?: () => void }[] {
  const pathname = usePathname();

  if (pathname.startsWith("/coach/clients") && !pathname.includes("/[clientId]") && pathname === "/coach/clients") {
    return [{ label: "Nouveau client", href: "#nouveau-client" }];
  }
  if (pathname.startsWith("/coach/programs")) {
    return [{ label: "Nouveau template", href: "/coach/programs/templates/new" }];
  }
  if (pathname.startsWith("/coach/assessments")) {
    return [{ label: "Nouveau bilan", href: "/coach/assessments/templates/new" }];
  }
  if (pathname.startsWith("/coach/comptabilite")) {
    return [{ label: "Nouvelle facture", href: "#" }];
  }
  if (pathname.startsWith("/coach/formules")) {
    return [{ label: "Nouvelle formule", href: "#" }];
  }
  return [{ label: "Nouveau", href: "#" }];
}

export default function DockBottom() {
  const pathname = usePathname();
  const items = useDockBottom();
  const plusActions = usePlusActions();
  const [plusOpen, setPlusOpen] = useState(false);

  const handlePlusClick = () => {
    if (plusActions.length === 1 && plusActions[0].href) {
      setPlusOpen(false);
    } else {
      setPlusOpen((v) => !v);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {/* Barre tabs clients — au-dessus du dock */}
      <ClientTabsBar />

      {/* Dock principal */}
      <div className="flex items-center gap-1 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-3 h-14 shadow-lg">

        {/* Items gauche (avant le +) */}
        {items.slice(0, Math.floor(items.length / 2)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "#" && item.href !== "" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href || "#"}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 h-10 rounded-xl transition-all duration-150 group min-w-[52px] ${
                active
                  ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                  : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.75} />
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Séparateur gauche */}
        {items.length > 0 && <div className="w-px h-6 bg-white/[0.06] mx-1" />}

        {/* Bouton + central */}
        <div className="relative">
          <button
            onClick={handlePlusClick}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1f8a65] text-white hover:bg-[#217356] active:scale-[0.95] transition-all duration-150"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>

          {/* Menu contextuel */}
          <AnimatePresence>
            {plusOpen && plusActions.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl overflow-hidden min-w-[180px]"
              >
                {plusActions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href || "#"}
                    onClick={() => setPlusOpen(false)}
                    className="flex items-center px-4 py-2.5 text-[12px] font-medium text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    {action.label}
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Séparateur droit */}
        {items.length > 0 && <div className="w-px h-6 bg-white/[0.06] mx-1" />}

        {/* Items droite (après le +) */}
        {items.slice(Math.floor(items.length / 2)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "#" && item.href !== "" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href || "#"}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 h-10 rounded-xl transition-all duration-150 group min-w-[52px] ${
                active
                  ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                  : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.75} />
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Si aucun item contextuel — dock minimaliste avec juste le + */}
        {items.length === 0 && (
          <span className="text-[9px] text-white/20 px-2">Actions</span>
        )}
      </div>

      {/* Overlay fermeture menu + */}
      {plusOpen && (
        <div className="fixed inset-0 z-[-1]" onClick={() => setPlusOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/DockBottom.tsx
git commit -m "feat(shell): add DockBottom — contextual floating dock with + action button"
```

---

## Task 6 : Refonte CoachShell — intégration double dock

**Files:**
- Modify: `components/layout/CoachShell.tsx`

- [ ] **Step 1 : Remplacer le contenu de CoachShell.tsx**

```tsx
// components/layout/CoachShell.tsx
"use client";

import { ReactNode } from "react";
import { TopBarProvider, useTopBar } from "@/components/layout/TopBarContext";
import { DockProvider } from "@/components/layout/DockContext";
import DockLeft from "@/components/layout/DockLeft";
import DockBottom from "@/components/layout/DockBottom";
import NotificationBell from "@/components/layout/NotificationBell";

// ─── TOPBAR ───────────────────────────────────────────────────────────────────

function TopBar() {
  const { content } = useTopBar();

  return (
    <header className="fixed top-4 right-4 left-[80px] h-16 z-40 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-5 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        {content.left ?? (
          <p className="text-[13px] font-semibold text-white/70">Coach</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {content.right}
        <NotificationBell />
      </div>
    </header>
  );
}

// ─── SHELL INNER ─────────────────────────────────────────────────────────────

function ShellInner({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121212]">
      <DockLeft />
      <TopBar />
      {/* pt = top-4(16) + h-16(64) + gap-4(16) = 96px | pl = left-4(16) + dock(48px) + gap(16) = 80px | pb = bottom-6(24) + dock(56px) + gap(16) = 96px */}
      <div className="min-h-screen bg-[#121212] pt-[96px] pl-[80px] pb-[96px]">
        {children}
      </div>
      <DockBottom />
    </div>
  );
}

// ─── SHELL (export public) ────────────────────────────────────────────────────

export default function CoachShell({ children }: { children: ReactNode }) {
  return (
    <TopBarProvider>
      <DockProvider>
        <ShellInner>{children}</ShellInner>
      </DockProvider>
    </TopBarProvider>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Démarrer le serveur dev et vérifier visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/dashboard` et vérifier :
- Dock gauche visible à gauche, centré verticalement
- Dock bas centré en bas
- TopBar en haut à droite
- Contenu principal scrollable sans être masqué par les docks
- Navigation entre Dashboard / Clients / Templates / Business fonctionne

- [ ] **Step 4 : Commit**

```bash
git add components/layout/CoachShell.tsx
git commit -m "feat(shell): refactor CoachShell — replace sidebar with double dock (DockLeft + DockBottom)"
```

---

## Task 7 : Mise à jour CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1 : Ajouter les entrées**

Ouvrir `CHANGELOG.md` et ajouter en tête de la section `## 2026-04-19` :

```
FEATURE: Replace CoachShell sidebar with double dock (DockLeft vertical + DockBottom horizontal)
FEATURE: DockBottom contextual items change per active route section
FEATURE: ClientTabsBar — open client tabs above bottom dock (Lab context)
FEATURE: DockContext — global state for open clients and active client tab
FEATURE: DockBottom + button opens contextual action menu (single action or multi-choice)
```

- [ ] **Step 2 : Vérifier TypeScript final**

```bash
npx tsc --noEmit
```
Expected : 0 erreurs.

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for Phase 1 double dock shell"
```

---

## Self-Review

### Spec coverage

| Requirement spec | Task couverte |
|---|---|
| Dock gauche vertical permanent, 5 entrées | Task 3 — DockLeft |
| Dock bas horizontal centré, contextuel | Task 5 — DockBottom |
| Bouton + central, non déplaçable, contextuel | Task 5 — DockBottom |
| Menu contextuel + si plusieurs actions | Task 5 — DockBottom `usePlusActions` |
| Barre de tabs clients au-dessus dock bas | Task 4 — ClientTabsBar |
| State clients ouverts / actif | Task 1 — DockContext |
| Items dock bas changent selon pathname | Task 2 — useDockBottom |
| Shell refactorisé sans sidebar | Task 6 — CoachShell |

### Points de vigilance

- `useDockBottom` retourne `[]` pour Dashboard → le dock bas affiche juste le bouton `+` (comportement attendu)
- Le `left-[80px]` du TopBar correspond à `left-4(16) + dock(48) + gap(16) = 80px` — à ajuster si le dock gauche change de taille
- La barre de tabs Lab est visible uniquement quand `openClients.length > 0` — elle n'apparaît pas sur les pages non-Lab
- Phase 1 ne touche pas aux pages internes (fiche client, builders) — elles continuent de fonctionner avec leur contenu existant via `useSetTopBar`
- La config dock configurable (drag-to-reorder, ajout/suppression) est hors scope Phase 1 — prévu Phase suivante
