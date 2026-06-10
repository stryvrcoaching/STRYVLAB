# UX Redesign — Phase 2A : Client Routing + Pages Squelettes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page monolithique `/coach/clients/[clientId]/page.tsx` (1510 lignes, 7 onglets) par un système de routes distinctes — une page par sous-section — naviguées via le dock bas contextuel.

**Architecture:** On crée un layout `/coach/clients/[clientId]/layout.tsx` qui charge les données client une fois et les passe via context à toutes les sous-pages. Chaque sous-page est un fichier indépendant. Le dock bas est mis à jour pour refléter les sous-pages du client actif. L'ancienne page monolithique est redirigée vers `/profil`.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Supabase client-side, React Context

**Spec:** `docs/superpowers/specs/2026-04-19-ux-redesign-navigation-lab.md`

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `app/coach/clients/[clientId]/layout.tsx` | Créer | Layout client — charge les données client, expose via ClientContext |
| `lib/client-context.tsx` | Créer | ClientContext — données client partagées entre toutes les sous-pages |
| `app/coach/clients/[clientId]/page.tsx` | Modifier | Redirect → `/coach/clients/[clientId]/profil` |
| `app/coach/clients/[clientId]/profil/page.tsx` | Créer | Page Profil — infos contact, scoring, accès, restrictions, formules |
| `app/coach/clients/[clientId]/data/page.tsx` | Créer | Page Data — squelette avec sous-navigation (Métriques, Bilans, Performances, MorphoPro) |
| `app/coach/clients/[clientId]/data/metriques/page.tsx` | Créer | Métriques + normes (extrait de l'ancien monolithe) |
| `app/coach/clients/[clientId]/data/bilans/page.tsx` | Créer | Bilans — liste soumissions (extrait de l'ancien monolithe) |
| `app/coach/clients/[clientId]/data/performances/page.tsx` | Créer | Performances + historique séances (extrait de l'ancien monolithe) |
| `app/coach/clients/[clientId]/data/morphopro/page.tsx` | Créer | MorphoPro (déplacé depuis l'onglet Profil) |
| `app/coach/clients/[clientId]/protocoles/page.tsx` | Créer | Page Protocoles — squelette avec sous-navigation (Nutrition, Entraînement, Cardio, Composition) |
| `app/coach/clients/[clientId]/protocoles/nutrition/page.tsx` | Créer | Nutrition — outils Macros & Calories, Carb Cycling, Hydratation, Cycle Sync |
| `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx` | Créer | Entraînement — programme assigné, builder, templates |
| `app/coach/clients/[clientId]/protocoles/cardio/page.tsx` | Créer | Cardio — HR Zones |
| `app/coach/clients/[clientId]/protocoles/composition/page.tsx` | Créer | Composition — Body Fat % |
| `components/layout/useDockBottom.ts` | Modifier | Ajouter les cas `/coach/clients/[clientId]/data` et `/protocoles` |
| `components/clients/ClientHeader.tsx` | Créer | Header client réutilisable — nom, statut, objectif, niveau |

---

## Task 1 : ClientContext — données client partagées

**Files:**
- Create: `lib/client-context.tsx`

- [ ] **Step 1 : Créer le context**

```tsx
// lib/client-context.tsx
"use client";

import { createContext, useContext, ReactNode } from "react";

export type ClientData = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  goal?: string;
  notes?: string;
  status?: string;
  training_goal?: string | null;
  fitness_level?: string | null;
  sport_practice?: string | null;
  weekly_frequency?: number | null;
  equipment_category?: string | null;
  created_at: string;
};

type ClientContextType = {
  client: ClientData;
  clientId: string;
  refetch: () => void;
};

const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({
  children,
  client,
  clientId,
  refetch,
}: {
  children: ReactNode;
  client: ClientData;
  clientId: string;
  refetch: () => void;
}) {
  return (
    <ClientContext.Provider value={{ client, clientId, refetch }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be called within ClientProvider");
  return ctx;
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "lib/client-context"
```
Expected : aucune sortie (0 erreurs sur ce fichier).

- [ ] **Step 3 : Commit**

```bash
git add lib/client-context.tsx
git commit -m "feat(lab): add ClientContext — shared client data across Lab sub-pages"
```

---

## Task 2 : ClientHeader — header client réutilisable

**Files:**
- Create: `components/clients/ClientHeader.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/clients/ClientHeader.tsx
"use client";

import { useClient } from "@/lib/client-context";
import { useDock } from "@/components/layout/DockContext";
import { useEffect } from "react";

const TRAINING_GOALS: Record<string, string> = {
  hypertrophy: "Hypertrophie",
  strength: "Force",
  fat_loss: "Perte de gras",
  endurance: "Endurance",
  recomp: "Recomposition",
  maintenance: "Maintenance",
  athletic: "Athletic",
};

const FITNESS_LEVELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Élite",
};

export default function ClientHeader() {
  const { client } = useClient();
  const { openClient } = useDock();

  // Enregistre ce client comme ouvert dans le dock (tab Chrome)
  useEffect(() => {
    openClient({
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
    });
  }, [client.id, client.first_name, client.last_name, openClient]);

  const initials = `${client.first_name[0]}${client.last_name[0]}`.toUpperCase();
  const goal = client.training_goal ? TRAINING_GOALS[client.training_goal] : null;
  const level = client.fitness_level ? FITNESS_LEVELS[client.fitness_level] : null;

  return (
    <div className="flex items-center gap-4 px-6 pt-6 pb-4">
      <div className="w-12 h-12 rounded-2xl bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 flex items-center justify-center shrink-0">
        <span className="text-[15px] font-bold text-[#1f8a65]">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-[16px] font-bold text-white leading-tight">
          {client.first_name} {client.last_name}
        </h1>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {goal && (
            <span className="text-[11px] text-white/50 font-medium">{goal}</span>
          )}
          {goal && level && <span className="text-white/20">·</span>}
          {level && (
            <span className="text-[11px] text-white/50 font-medium">{level}</span>
          )}
          {client.status && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              client.status === "active"
                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                : "bg-white/[0.06] text-white/40"
            }`}>
              {client.status === "active" ? "Actif" : client.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "ClientHeader"
```
Expected : aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add components/clients/ClientHeader.tsx
git commit -m "feat(lab): add ClientHeader — reusable client identity header with dock tab registration"
```

---

## Task 3 : Layout client — charge données + ClientProvider

**Files:**
- Create: `app/coach/clients/[clientId]/layout.tsx`

- [ ] **Step 1 : Créer le layout**

```tsx
// app/coach/clients/[clientId]/layout.tsx
"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientProvider, type ClientData } from "@/lib/client-context";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      if (data.client) {
        setClient(data.client);
      } else {
        setError("Client introuvable");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  if (loading) {
    return (
      <div className="px-6 pt-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="px-6 pt-10 text-center">
        <p className="text-[14px] text-white/50">{error || "Client introuvable"}</p>
        <button
          onClick={() => router.push("/coach/clients")}
          className="mt-4 text-[12px] text-[#1f8a65] hover:text-[#1f8a65]/70 transition-colors"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <ClientProvider client={client} clientId={clientId} refetch={fetchClient}>
      {children}
    </ClientProvider>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "clients/\[clientId\]/layout"
```
Expected : aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add app/coach/clients/[clientId]/layout.tsx
git commit -m "feat(lab): add client layout — loads client data once, exposes via ClientProvider"
```

---

## Task 4 : Redirect page.tsx + mise à jour useDockBottom

**Files:**
- Modify: `app/coach/clients/[clientId]/page.tsx`
- Modify: `components/layout/useDockBottom.ts`

- [ ] **Step 1 : Remplacer page.tsx par une redirect**

Remplacer l'intégralité de `app/coach/clients/[clientId]/page.tsx` par :

```tsx
// app/coach/clients/[clientId]/page.tsx
import { redirect } from "next/navigation";

export default function ClientPage({
  params,
}: {
  params: { clientId: string };
}) {
  redirect(`/coach/clients/${params.clientId}/profil`);
}
```

- [ ] **Step 2 : Mettre à jour useDockBottom.ts**

Lire `components/layout/useDockBottom.ts` puis ajouter les cas client avant le cas Business. Remplacer le début de la fonction `useDockBottom` (après `const pathname = usePathname();`) par :

```ts
  // Lab — client ouvert — Data & Analyse
  if (pathname.includes("/coach/clients/") && pathname.includes("/data")) {
    const clientId = pathname.split("/coach/clients/")[1]?.split("/")[0];
    return [
      { id: "metriques", label: "Métriques", href: `/coach/clients/${clientId}/data/metriques`, icon: BarChart2 },
      { id: "bilans", label: "Bilans", href: `/coach/clients/${clientId}/data/bilans`, icon: ClipboardList },
      { id: "performances", label: "Performances", href: `/coach/clients/${clientId}/data/performances`, icon: TrendingUp },
      { id: "morphopro", label: "MorphoPro", href: `/coach/clients/${clientId}/data/morphopro`, icon: Scan },
    ];
  }

  // Lab — client ouvert — Protocoles
  if (pathname.includes("/coach/clients/") && pathname.includes("/protocoles")) {
    const clientId = pathname.split("/coach/clients/")[1]?.split("/")[0];
    return [
      { id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/protocoles/nutrition`, icon: Utensils },
      { id: "entrainement", label: "Entraînement", href: `/coach/clients/${clientId}/protocoles/entrainement`, icon: Dumbbell },
      { id: "cardio", label: "Cardio", href: `/coach/clients/${clientId}/protocoles/cardio`, icon: HeartPulse },
      { id: "composition", label: "Composition", href: `/coach/clients/${clientId}/protocoles/composition`, icon: BarChart3 },
    ];
  }

  // Lab — client ouvert — page racine (profil)
  if (pathname.match(/^\/coach\/clients\/[^/]+\/(profil)?$/)) {
    const clientId = pathname.split("/coach/clients/")[1]?.split("/")[0];
    return [
      { id: "profil", label: "Profil", href: `/coach/clients/${clientId}/profil`, icon: UserCircle },
      { id: "data", label: "Data & Analyse", href: `/coach/clients/${clientId}/data/metriques`, icon: BarChart2 },
      { id: "protocoles", label: "Protocoles", href: `/coach/clients/${clientId}/protocoles/nutrition`, icon: Layers },
    ];
  }
```

Ajouter `Layers` et `UserCircle` aux imports existants en haut du fichier si pas déjà présents.

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep -E "useDockBottom|clients/\[clientId\]/page"
```
Expected : aucune sortie.

- [ ] **Step 4 : Commit**

```bash
git add app/coach/clients/[clientId]/page.tsx components/layout/useDockBottom.ts
git commit -m "feat(lab): redirect /clients/[id] to /profil + update useDockBottom for client sub-pages"
```

---

## Task 5 : Page Profil client

**Files:**
- Create: `app/coach/clients/[clientId]/profil/page.tsx`

- [ ] **Step 1 : Créer la page**

```tsx
// app/coach/clients/[clientId]/profil/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import ClientAccessToken from "@/components/clients/ClientAccessToken";
import RestrictionsWidget from "@/components/clients/RestrictionsWidget";
import ClientFormulasTab from "@/components/crm/ClientFormulasTab";
import ClientCrmTab from "@/components/crm/ClientCrmTab";
import DeleteClientModal from "@/components/clients/DeleteClientModal";
import { useState } from "react";
import {
  Mail, Phone, Calendar, Edit2, Save, Loader2,
} from "lucide-react";

const TRAINING_GOALS = [
  { value: "hypertrophy", label: "Hypertrophie" },
  { value: "strength", label: "Force" },
  { value: "fat_loss", label: "Perte de gras" },
  { value: "endurance", label: "Endurance" },
  { value: "recomp", label: "Recomposition" },
  { value: "maintenance", label: "Maintenance" },
  { value: "athletic", label: "Athletic" },
];
const FITNESS_LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
  { value: "elite", label: "Élite" },
];
const SPORT_PRACTICES = [
  { value: "sedentary", label: "Sédentaire" },
  { value: "light", label: "Légèrement actif" },
  { value: "moderate", label: "Modérément actif" },
  { value: "active", label: "Actif" },
  { value: "athlete", label: "Athlète" },
];
const EQUIPMENT_CATEGORIES = [
  { value: "bodyweight", label: "Poids du corps" },
  { value: "home_dumbbells", label: "Domicile — Haltères" },
  { value: "home_full", label: "Domicile — Complet" },
  { value: "home_rack", label: "Rack à domicile" },
  { value: "functional_box", label: "Box / Fonctionnel" },
  { value: "commercial_gym", label: "Salle de sport" },
];

export default function ProfilPage() {
  const { client, clientId, refetch } = useClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [draft, setDraft] = useState({
    training_goal: client.training_goal ?? "",
    fitness_level: client.fitness_level ?? "",
    sport_practice: client.sport_practice ?? "",
    weekly_frequency: client.weekly_frequency?.toString() ?? "",
    equipment_category: client.equipment_category ?? "",
    notes: client.notes ?? "",
  });

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Profil
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  async function save() {
    setSaving(true);
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        training_goal: draft.training_goal || null,
        fitness_level: draft.fitness_level || null,
        sport_practice: draft.sport_practice || null,
        weekly_frequency: draft.weekly_frequency ? Number(draft.weekly_frequency) : null,
        equipment_category: draft.equipment_category || null,
        notes: draft.notes || null,
      }),
    });
    await refetch();
    setSaving(false);
    setEditing(false);
  }

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />

      <div className="px-6 pb-24 space-y-4">
        {/* Infos contact */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              Informations
            </p>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                <Edit2 size={12} /> Modifier
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-[11px] text-white/40 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-[#1f8a65] hover:bg-[#217356] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Enregistrer
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {client.email && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Mail size={13} className="text-white/40" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Email</p>
                  <p className="text-[13px] text-white font-medium">{client.email}</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Phone size={13} className="text-white/40" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Téléphone</p>
                  <p className="text-[13px] text-white font-medium">{client.phone}</p>
                </div>
              </div>
            )}
            {client.date_of_birth && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Calendar size={13} className="text-white/40" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Date de naissance</p>
                  <p className="text-[13px] text-white font-medium">
                    {new Date(client.date_of_birth).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <Calendar size={13} className="text-white/40" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Client depuis</p>
                <p className="text-[13px] text-white font-medium">
                  {new Date(client.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profil sportif — lecture ou édition */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
            Profil sportif
          </p>
          {!editing ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Objectif", value: TRAINING_GOALS.find(g => g.value === client.training_goal)?.label },
                { label: "Niveau", value: FITNESS_LEVELS.find(l => l.value === client.fitness_level)?.label },
                { label: "Activité", value: SPORT_PRACTICES.find(s => s.value === client.sport_practice)?.label },
                { label: "Fréquence", value: client.weekly_frequency ? `${client.weekly_frequency}j/sem.` : null },
                { label: "Équipement", value: EQUIPMENT_CATEGORIES.find(e => e.value === client.equipment_category)?.label },
              ].filter(f => f.value).map(field => (
                <div key={field.label}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1">{field.label}</p>
                  <p className="text-[13px] text-white font-semibold">{field.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Objectif</label>
                <select
                  value={draft.training_goal}
                  onChange={e => setDraft(d => ({ ...d, training_goal: e.target.value }))}
                  className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-10 text-[13px] text-white outline-none"
                >
                  <option value="">—</option>
                  {TRAINING_GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Niveau</label>
                <select
                  value={draft.fitness_level}
                  onChange={e => setDraft(d => ({ ...d, fitness_level: e.target.value }))}
                  className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-10 text-[13px] text-white outline-none"
                >
                  <option value="">—</option>
                  {FITNESS_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Activité</label>
                <select
                  value={draft.sport_practice}
                  onChange={e => setDraft(d => ({ ...d, sport_practice: e.target.value }))}
                  className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-10 text-[13px] text-white outline-none"
                >
                  <option value="">—</option>
                  {SPORT_PRACTICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Fréquence (j/sem)</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={draft.weekly_frequency}
                  onChange={e => setDraft(d => ({ ...d, weekly_frequency: e.target.value }))}
                  className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-10 text-[13px] text-white outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Équipement</label>
                <select
                  value={draft.equipment_category}
                  onChange={e => setDraft(d => ({ ...d, equipment_category: e.target.value }))}
                  className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-10 text-[13px] text-white outline-none"
                >
                  <option value="">—</option>
                  {EQUIPMENT_CATEGORIES.map(eq => <option key={eq.value} value={eq.value}>{eq.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 py-2.5 text-[13px] text-white outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Restrictions physiques */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
            Restrictions physiques
          </p>
          <RestrictionsWidget clientId={clientId} />
        </div>

        {/* Accès client */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
            Accès client
          </p>
          <ClientAccessToken clientId={clientId} />
        </div>

        {/* Formules */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
            Formules & abonnement
          </p>
          <ClientFormulasTab clientId={clientId} />
        </div>

        {/* CRM */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
            Notes CRM
          </p>
          <ClientCrmTab clientId={clientId} />
        </div>

        {/* Zone dangereuse */}
        <div className="bg-red-950/20 border-[0.3px] border-red-500/20 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400/60 mb-3">
            Zone dangereuse
          </p>
          <button
            onClick={() => setShowDelete(true)}
            className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors font-medium"
          >
            Supprimer ou archiver ce client
          </button>
        </div>
      </div>

      {showDelete && (
        <DeleteClientModal
          clientId={clientId}
          clientName={`${client.first_name} ${client.last_name}`}
          onClose={() => setShowDelete(false)}
          onDeleted={() => {}}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "profil/page"
```
Expected : aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add app/coach/clients/[clientId]/profil/page.tsx
git commit -m "feat(lab): add /profil page — client info, sport profile, restrictions, access, formulas"
```

---

## Task 6 : Pages Data & Analyse — squelettes + Métriques

**Files:**
- Create: `app/coach/clients/[clientId]/data/metriques/page.tsx`
- Create: `app/coach/clients/[clientId]/data/bilans/page.tsx`
- Create: `app/coach/clients/[clientId]/data/performances/page.tsx`
- Create: `app/coach/clients/[clientId]/data/morphopro/page.tsx`

- [ ] **Step 1 : Créer la page Métriques**

```tsx
// app/coach/clients/[clientId]/data/metriques/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import MetricsSection from "@/components/clients/MetricsSection";

export default function MetriquesPage() {
  const { client, clientId } = useClient();

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Data</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Métriques
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        <MetricsSection clientId={clientId} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2 : Créer la page Bilans**

```tsx
// app/coach/clients/[clientId]/data/bilans/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import SubmissionsList from "@/components/assessments/dashboard/SubmissionsList";
import { SubmissionWithClient } from "@/types/assessment";

export default function BilansPage() {
  const { client, clientId } = useClient();
  const [submissions, setSubmissions] = useState<SubmissionWithClient[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/assessments/submissions?client_id=${clientId}`).then(r => r.json()),
      fetch("/api/assessments/templates").then(r => r.json()),
    ]).then(([subsData, templatesData]) => {
      setSubmissions(subsData.submissions ?? []);
      setTemplates(templatesData.templates ?? []);
    }).finally(() => setLoading(false));
  }, [clientId]);

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Data</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Bilans
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  async function handleSendBilan(templateId: string, bilanDate: string, sendEmail: boolean) {
    const res = await fetch("/api/assessments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        template_id: templateId,
        filled_by: "client",
        send_email: sendEmail,
        bilan_date: bilanDate,
      }),
    });
    const d = await res.json();
    if (d.submission) {
      setSubmissions(prev => [{
        ...d.submission,
        template: templates.find(t => t.id === templateId),
        client: { id: clientId, first_name: client.first_name, last_name: client.last_name },
      }, ...prev] as SubmissionWithClient[]);
    }
  }

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        {loading ? (
          <div className="text-[12px] text-white/30 py-8 text-center">Chargement…</div>
        ) : (
          <SubmissionsList
            submissions={submissions}
            templates={templates}
            clientId={clientId}
            onSendBilan={handleSendBilan}
          />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3 : Créer la page Performances**

```tsx
// app/coach/clients/[clientId]/data/performances/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import SessionHistory from "@/components/clients/SessionHistory";
import PerformanceDashboard from "@/components/clients/PerformanceDashboard";
import ProgressionHistory from "@/components/clients/ProgressionHistory";

export default function PerformancesPage() {
  const { client, clientId } = useClient();

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Data</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Performances
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24 space-y-6">
        <PerformanceDashboard clientId={clientId} />
        <SessionHistory clientId={clientId} />
        <ProgressionHistory clientId={clientId} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4 : Créer la page MorphoPro**

```tsx
// app/coach/clients/[clientId]/data/morphopro/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import { MorphoAnalysisSection } from "@/components/clients/MorphoAnalysisSection";

export default function MorphoProPage() {
  const { client, clientId } = useClient();

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Data</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — MorphoPro
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        <MorphoAnalysisSection clientId={clientId} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "data/"
```
Expected : aucune sortie.

- [ ] **Step 6 : Commit**

```bash
git add app/coach/clients/[clientId]/data/
git commit -m "feat(lab): add Data & Analyse pages — Métriques, Bilans, Performances, MorphoPro"
```

---

## Task 7 : Pages Protocoles — squelettes avec outils

**Files:**
- Create: `app/coach/clients/[clientId]/protocoles/nutrition/page.tsx`
- Create: `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx`
- Create: `app/coach/clients/[clientId]/protocoles/cardio/page.tsx`
- Create: `app/coach/clients/[clientId]/protocoles/composition/page.tsx`

- [ ] **Step 1 : Créer la page Nutrition**

```tsx
// app/coach/clients/[clientId]/protocoles/nutrition/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import Link from "next/link";
import { Utensils, RefreshCw, Droplet, Moon, ArrowRight } from "lucide-react";

const NUTRITION_TOOLS = [
  {
    id: "macros",
    href: "/outils/macros",
    icon: Utensils,
    title: "Kcal & Macros",
    description: "Besoins caloriques & macronutriments avec données client injectées.",
  },
  {
    id: "carb-cycling",
    href: "/outils/carb-cycling",
    icon: RefreshCw,
    title: "Carb Cycling",
    description: "Stratégie glucidique cyclique pour la performance.",
  },
  {
    id: "hydratation",
    href: "/outils/hydratation",
    icon: Droplet,
    title: "Hydratation",
    description: "Besoins hydriques selon activité et taux de sudation.",
  },
  {
    id: "cycle-sync",
    href: "/outils/cycle-sync",
    icon: Moon,
    title: "Cycle Sync",
    description: "Nutrition adaptée aux fluctuations hormonales.",
  },
];

export default function NutritionPage() {
  const { client } = useClient();

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Protocoles</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Nutrition
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
          Outils nutrition
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {NUTRITION_TOOLS.map(tool => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group flex items-center gap-4 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 text-white/40 group-hover:text-[#1f8a65] transition-colors">
                  <Icon size={18} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white">{tool.title}</p>
                  <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">{tool.description}</p>
                </div>
                <ArrowRight size={14} className="text-white/20 group-hover:text-[#1f8a65] transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2 : Créer la page Entraînement**

```tsx
// app/coach/clients/[clientId]/protocoles/entrainement/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import ProgramEditor from "@/components/programs/ProgramEditor";

export default function EntrainementPage() {
  const { client, clientId } = useClient();
  const [programs, setPrograms] = useState<any[]>([]);
  const [programTemplates, setProgramTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/programs?client_id=${clientId}`).then(r => r.json()),
      fetch("/api/program-templates").then(r => r.json()),
    ]).then(([progsData, templatesData]) => {
      setPrograms(progsData.programs ?? []);
      setProgramTemplates(templatesData.templates ?? []);
    }).finally(() => setLoading(false));
  }, [clientId]);

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Protocoles</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Entraînement
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        {loading ? (
          <div className="text-[12px] text-white/30 py-8 text-center">Chargement…</div>
        ) : (
          <ProgramEditor
            clientId={clientId}
            programs={programs}
            programTemplates={programTemplates}
            onProgramsChange={setPrograms}
          />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3 : Créer la page Cardio**

```tsx
// app/coach/clients/[clientId]/protocoles/cardio/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import Link from "next/link";
import { HeartPulse, ArrowRight } from "lucide-react";

export default function CardioPage() {
  const { client } = useClient();

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Protocoles</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Cardio
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
          Outils cardio
        </p>
        <Link
          href="/outils/hr-zones"
          className="group flex items-center gap-4 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 text-white/40 group-hover:text-[#1f8a65] transition-colors">
            <HeartPulse size={18} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">HR Zones</p>
            <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">
              Zones cardiaques cibles via méthode Karvonen.
            </p>
          </div>
          <ArrowRight size={14} className="text-white/20 group-hover:text-[#1f8a65] transition-colors shrink-0" />
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4 : Créer la page Composition**

```tsx
// app/coach/clients/[clientId]/protocoles/composition/page.tsx
"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useClient } from "@/lib/client-context";
import ClientHeader from "@/components/clients/ClientHeader";
import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";

export default function CompositionPage() {
  const { client } = useClient();

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">Lab · Protocoles</p>
        <p className="text-[13px] font-semibold text-white leading-none">
          {client.first_name} {client.last_name} — Composition
        </p>
      </div>
    ),
    [client.first_name, client.last_name],
  );
  useSetTopBar(topBarLeft);

  return (
    <main className="min-h-screen bg-[#121212]">
      <ClientHeader />
      <div className="px-6 pb-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
          Outils composition corporelle
        </p>
        <Link
          href="/outils/body-fat"
          className="group flex items-center gap-4 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 text-white/40 group-hover:text-[#1f8a65] transition-colors">
            <BarChart3 size={18} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">Body Fat %</p>
            <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">
              Estimation masse grasse via Navy Method & Jackson-Pollock.
            </p>
          </div>
          <ArrowRight size={14} className="text-white/20 group-hover:text-[#1f8a65] transition-colors shrink-0" />
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "protocoles/"
```
Expected : aucune sortie.

- [ ] **Step 6 : Commit**

```bash
git add app/coach/clients/[clientId]/protocoles/
git commit -m "feat(lab): add Protocoles pages — Nutrition, Entraînement, Cardio, Composition"
```

---

## Task 8 : Mise à jour liste clients — openClient au clic

**Files:**
- Modify: `app/coach/clients/page.tsx`

- [ ] **Step 1 : Ajouter openClient au clic sur un client**

Lire `app/coach/clients/page.tsx`. Trouver le composant qui rend chaque carte client et le lien vers la fiche client. Ajouter un appel à `useDock().openClient()` au clic avant la navigation.

Le pattern exact à trouver est un `Link` ou un `onClick` qui navigue vers `/coach/clients/${client.id}`. Ajouter :

```tsx
// En haut du composant de liste clients, ajouter :
import { useDock } from "@/components/layout/DockContext";

// Dans le composant :
const { openClient } = useDock();

// Sur le onClick de chaque carte client, avant router.push ou en onClick du Link :
onClick={() => {
  openClient({ id: client.id, firstName: client.first_name, lastName: client.last_name });
}}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "clients/page"
```
Expected : aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add app/coach/clients/page.tsx
git commit -m "feat(lab): register client in dock tabs on click from client list"
```

---

## Task 9 : CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1 : Ajouter les entrées**

Ajouter en tête de la section `## 2026-04-20` :

```
FEATURE: Phase 2A — replace client monolith with routed Lab sub-pages (profil, data, protocoles)
FEATURE: ClientContext — shared client data loaded once in layout, consumed by all sub-pages
FEATURE: ClientHeader — reusable client identity header with automatic dock tab registration
FEATURE: /data pages — Métriques, Bilans, Performances, MorphoPro as distinct routes
FEATURE: /protocoles pages — Nutrition, Entraînement, Cardio, Composition as distinct routes
FEATURE: useDockBottom — client sub-page aware (data/*, protocoles/* routes)
REFACTOR: /coach/clients/[clientId]/page.tsx — redirect to /profil (monolith removed)
```

- [ ] **Step 2 : Vérifier TypeScript final**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -5
```
Expected : uniquement les erreurs pré-existantes (Stripe, BodyFatCalculator).

- [ ] **Step 3 : Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for Phase 2A client routing"
```

---

## Self-Review

### Spec coverage

| Requirement spec | Task couverte |
|---|---|
| Page Profil — infos, sport, restrictions, accès, formules | Task 5 |
| Page Data & Analyse — Métriques | Task 6 |
| Page Data & Analyse — Bilans | Task 6 |
| Page Data & Analyse — Performances | Task 6 |
| MorphoPro déplacé dans Data & Analyse | Task 6 |
| Page Protocoles — Nutrition (4 outils) | Task 7 |
| Page Protocoles — Entraînement | Task 7 |
| Page Protocoles — Cardio | Task 7 |
| Page Protocoles — Composition | Task 7 |
| Dock bas contextuel par sous-page client | Task 4 |
| Tabs clients enregistrés au clic | Task 8 |
| Layout client charge données une fois | Task 3 |
| Redirect /page → /profil | Task 4 |

### Points de vigilance

- `ProgramEditor` dans la page Entraînement attend des props spécifiques — vérifier sa signature réelle avant d'implémenter Task 7 Step 2. Si `ProgramEditor` n'accepte pas `onProgramsChange`, adapter.
- Le layout `app/coach/clients/[clientId]/layout.tsx` est un Client Component car il utilise `useState`/`useEffect` — c'est intentionnel pour permettre le `refetch` via context.
- `app/coach/clients/[clientId]/page.tsx` avec `redirect()` doit être un Server Component (pas de `"use client"`) pour que le redirect fonctionne côté serveur.
- Les pages Data et Protocoles appellent `useSetTopBar` — elles doivent avoir `"use client"` en tête.
- `useDockBottom` reçoit maintenant des hrefs dynamiques avec clientId — le `isActive()` dans `DockBottom` doit matcher correctement les routes `/coach/clients/[uuid]/data/metriques` etc.
