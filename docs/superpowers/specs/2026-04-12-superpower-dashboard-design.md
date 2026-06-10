# Superpower Coach Dashboard — Design Spec

**Date :** 2026-04-12  
**Route :** `/dashboard`  
**Approche :** Single scroll — sections empilées par ordre de priorité  
**Statut :** Approuvé

---

## Contexte

La page `/dashboard` existante est une coquille vide : 4 KPIs statiques (dont 2 hardcodés), des placeholders Kanban/Agenda non fonctionnels, et 4 actions rapides basiques. Elle est remplacée intégralement par le Superpower Dashboard.

**Objectif :** En moins de 5 secondes, le coach sait :
1. Un résumé intelligent de son état (D)
2. Où en sont ses clients (C)
3. Ce qui requiert son attention aujourd'hui (A)
4. La santé financière de son business (B)

---

## Architecture générale

**Approche :** Single scroll — une colonne principale, sections empilées dans l'ordre de priorité.

**Data fetching :** Un seul endpoint `GET /api/dashboard/coach` retourne toutes les données agrégées en parallèle côté serveur. Pas de fetch en cascade côté client.

**Composants :** Tous isolés dans `components/dashboard/`. La page `app/dashboard/page.tsx` est un orchestrateur léger.

---

## Section 1 — Hero Summary

Hauteur totale ~80px. Toujours visible, jamais de skeleton visible plus de 300ms.

### 1a — Phrase narrative dynamique

Générée à partir des données agrégées :

- Cas normal : `"Bonjour Kévin — 3 actions requises · MRR 2 400€ · 2 bilans en attente"`
- Cas tout OK : `"Tout est à jour — bonne journée, Kévin."`
- Les chiffres significatifs (alertes, MRR, bilans) sont en `text-[#1f8a65] font-bold`

### 1b — Command bar horizontal

5 stats sur une ligne, séparées par `·` :

| Stat | Source DB |
|---|---|
| `N clients actifs` | `coach_clients` WHERE status = 'active' |
| `MRR Xe` | subscriptions actives × prix formule |
| `N bilans en attente` | `assessment_submissions` WHERE status = 'sent' |
| `N alertes` | agrégé (paiements retard + inactivité clients) |
| `Revenu ce mois` | `payments` WHERE status = 'paid' AND mois courant |

Design : labels `text-[10px] text-white/35 uppercase tracking-[0.14em]`, valeurs `text-[13px] text-white font-bold`.

**Composant :** `components/dashboard/HeroSummary.tsx`

---

## Section 2 — Alertes + Actions

Bloc conditionnel — masqué si `alerts.length === 0`.

### 2a — Fil d'alertes priorisé

Triées par sévérité décroissante. Max 5 affichées, lien "Voir toutes" si plus.

| Niveau | Couleur border | Déclencheur |
|---|---|---|
| 🔴 Critique | `border-red-500/20` | Paiement en retard >7j, abonnement expiré |
| 🟠 Urgent | `border-amber-500/20` | Bilan sans réponse >5j, client inactif >14j |
| 🟡 Info | `border-white/[0.06]` | Abonnement expire dans 7j, client sans bilan >30j |

Chaque alerte = une ligne : icône sévérité + texte descriptif + lien d'action direct (`→ Voir`, `→ Relancer`, `→ Facture`).

### 2b — Actions contextuelles dynamiques (1-2 boutons)

Affichés au-dessus de la grille d'actions fixes. Logique :

- Si alertes critiques → `Traiter les retards` (accent `#1f8a65`)
- Sinon si bilans en attente → `Traiter les bilans (N)` (accent `#1f8a65`)
- Sinon → `Nouveau client` (accent par défaut)

### 2c — Grille d'actions fixes (6 actions, 3×2)

| Action | Destination |
|---|---|
| Nouveau client | `/coach/clients` |
| Envoyer un bilan | `/coach/assessments` |
| Nouveau programme | `/coach/programs/templates` |
| Voir bilans en attente | `/coach/assessments?filter=pending` |
| Envoyer rappel paiement | `/coach/comptabilite?filter=overdue` |
| Calculer | `/outils?from=dashboard` |

Design : FeatureRow pattern DS v2.0, `rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06]`.

**Composants :** `components/dashboard/AlertsFeed.tsx` + `components/dashboard/QuickActions.tsx`

---

## Section 3 — Clients

### 3a — Barre de segmentation

3 badges-filtres cliquables :

| Badge | Critère | Couleur |
|---|---|---|
| `En progrès (N)` | Bilan complété <30j ET métriques en amélioration | `text-[#1f8a65]` |
| `Stagnants (N)` | Dernier bilan >30j OU métriques plates | `text-amber-400` |
| `Inactifs (N)` | Aucune activité >45j | `text-red-400` |

Clic → filtre la liste. Par défaut : tous affichés.

### 3b — Cards clients

Grille 2 colonnes desktop / 1 colonne mobile. Max 8 clients, triés par date d'activité décroissante. Bouton "Voir tous les clients" en bas.

Structure d'une card :
```
[Avatar initiales]   Prénom Nom                    [Badge statut abo]
                     Dernier bilan : il y a 8j
                     Poids 82kg  ·  BF% 18.2%  ·  △ -1.2kg
                     [Sparkline poids 60j — si données dispo]
                     [Voir profil →]
```

- Avatar : cercle `bg-[#1f8a65]/20 text-[#1f8a65]`, initiales
- Badge statut abonnement : `Actif · Formule Pro` ou `Expiré` (rouge si expiré)
- Sparkline : mini SVG inline, visible uniquement si ≥3 points de données
- Delta métrique : `text-[#1f8a65]` si positif (amélioration), `text-red-400` si négatif
- Click card → `/coach/clients/[clientId]`

### 3c — État vide

Si `clients.length === 0` : banner onboarding existant (déjà dans le code actuel — réutilisé tel quel).

**Composant :** `components/dashboard/ClientsSection.tsx`

---

## Section 4 — Financier Condensé

Pas de graphiques. 4 stat cards sur une ligne (2×2 mobile).

| Card | Source | Note |
|---|---|---|
| MRR | subscriptions actives × formule | — |
| Revenu ce mois | payments status=paid, mois courant | — |
| En attente | payments status=pending | — |
| En retard | payments status=overdue | `border-red-500/20` si > 0 |

Design : `bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5`. Label `text-[9px] text-white/30 uppercase`, valeur `text-3xl font-black text-white`.

Lien discret en bas : `→ Voir la comptabilité complète` → `/coach/comptabilite`  
Style : `text-[11px] text-white/35 hover:text-white/60`

**Composant :** `components/dashboard/FinancialStrip.tsx`

---

## API — `GET /api/dashboard/coach`

Endpoint dédié, authentifié coach. Retourne toutes les données en un seul appel :

```typescript
type DashboardCoachData = {
  hero: {
    coachFirstName: string;
    activeClients: number;
    mrr: number;
    pendingSubmissions: number;
    alertCount: number;
    revenueThisMonth: number;
  };
  alerts: {
    id: string;
    severity: 'critical' | 'urgent' | 'info';
    message: string;
    actionLabel: string;
    actionHref: string;
    clientId?: string;
    clientName?: string;
  }[];
  clients: {
    id: string;
    firstName: string;
    lastName: string;
    status: 'progressing' | 'stagnant' | 'inactive';
    lastActivityDays: number;
    lastMetrics: { weight?: number; bodyFatPct?: number; delta?: number } | null;
    weightHistory: { date: string; value: number }[];  // pour sparkline
    subscription: { formulaName: string; status: string } | null;
  }[];
  financial: {
    mrr: number;
    revenueThisMonth: number;
    pending: number;
    overdue: number;
  };
};
```

Toutes les requêtes DB exécutées en parallèle via `Promise.all`. Auth via pattern existant `getAuthCoach`.

---

## Composants — Arborescence

```
components/dashboard/
  HeroSummary.tsx       — phrase narrative + command bar
  AlertsFeed.tsx        — fil d'alertes + actions contextuelles
  QuickActions.tsx      — grille 6 actions fixes
  ClientsSection.tsx    — segmentation + cards + sparkline
  FinancialStrip.tsx    — 4 stat cards financières
```

La page `app/dashboard/page.tsx` :
1. Fetch `GET /api/dashboard/coach`
2. Skeleton pendant le chargement (pattern DS v2.0 existant)
3. Compose les 5 composants dans l'ordre

---

## États de chargement

Skeleton DS v2.0 pour chaque section indépendamment. L'ordre d'affichage reste stable même si une section charge plus vite.

---

## Ce qui est hors scope (Phase 2)

- Kanban / Agenda (placeholders supprimés pour l'instant)
- Graphiques MRR / volume bilans
- Notifications temps réel (WebSocket)
- Filtres avancés dans la section clients
- Export dashboard en PDF
