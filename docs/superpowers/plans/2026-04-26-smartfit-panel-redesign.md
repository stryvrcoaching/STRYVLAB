# SmartFit Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner `ProgramIntelligencePanel` et `LabModeSection` en un seul composant unifié — supprimer les doublons (subscores, alertes), réorganiser en 3 couches de profondeur (En-tête / Analyse / Lab), et rendre la heatmap et les overrides compréhensibles.

**Architecture:** `ProgramIntelligencePanel` absorbe tout le contenu de `LabModeSection`. `LabModeSection` est supprimé. `IntelligencePanelShell` ne render plus que `ProgramIntelligencePanel` (plus de render séparé de LabModeSection). Les alertes sont retirées du panneau — elles restent uniquement en badges inline sur chaque exercice via `IntelligenceAlertBadge`.

**Tech Stack:** React, TypeScript, Framer Motion, Tailwind CSS, Lucide React. Aucun changement moteur (`lib/programs/intelligence/*` inchangé).

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| `components/programs/ProgramIntelligencePanel.tsx` | Refactor majeur — absorbe LabModeSection, supprime grille subscores top-level, alertes, donut |
| `components/programs/studio/LabModeSection.tsx` | **Supprimé** |
| `components/programs/studio/IntelligencePanelShell.tsx` | Retirer import + render de LabModeSection, passer les nouveaux props à ProgramIntelligencePanel |
| `components/programs/ProgramTemplateBuilder.tsx` | Passer les props Lab directement à IntelligencePanelShell (déjà le cas — vérifier cohérence) |

---

## Task 1 — Mettre à jour l'interface Props de ProgramIntelligencePanel

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx:13-18`

- [ ] **Step 1 : Remplacer l'interface Props existante**

Ouvrir `components/programs/ProgramIntelligencePanel.tsx`. Remplacer les lignes 13–18 :

```tsx
interface Props {
  result: IntelligenceResult
  weeks: number
  meta: TemplateMeta
  onAlertClick?: (sessionIndex: number, exerciseIndex: number) => void
}
```

par :

```tsx
interface Props {
  result: IntelligenceResult
  meta: TemplateMeta
  morphoConnected?: boolean
  morphoDate?: string
  sraHeatmap?: SRAHeatmapWeek[]
  labOverrides?: Record<string, number>
  presentPatterns?: string[]
  onOverrideChange?: (pattern: string, value: number) => void
  onOverrideReset?: () => void
  onAlertClick?: (sessionIndex: number, exerciseIndex: number) => void
}
```

- [ ] **Step 2 : Mettre à jour la signature de la fonction**

Remplacer la ligne 182 :

```tsx
export default function ProgramIntelligencePanel({ result, meta, onAlertClick }: Props) {
```

par :

```tsx
export default function ProgramIntelligencePanel({
  result, meta, onAlertClick,
  morphoConnected, morphoDate, sraHeatmap,
  labOverrides, presentPatterns, onOverrideChange, onOverrideReset,
}: Props) {
```

- [ ] **Step 3 : Ajouter les imports manquants en tête de fichier**

Ajouter dans les imports existants (ligne ~1–11) :

```tsx
import { Sliders, FlaskConical, Microscope, HelpCircle } from 'lucide-react'
import type { SRAHeatmapWeek } from '@/lib/programs/intelligence'
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Attendu : erreurs sur les usages de `weeks` (prop supprimé) et les sections pas encore modifiées — normal à ce stade.

---

## Task 2 — Supprimer la grille subscores, les alertes et le donut du panneau principal

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

- [ ] **Step 1 : Supprimer la grille subscores (lignes ~256–275)**

Localiser et supprimer le bloc :

```tsx
{/* ── Grille subscores ── */}
<div className="grid grid-cols-2 gap-1.5">
  {Object.entries(result.subscores).map(([key, val]) => {
    ...
  })}
</div>
```

- [ ] **Step 2 : Supprimer le donut "Patterns de mouvement" (lignes ~428–450)**

Localiser et supprimer le bloc :

```tsx
{/* ── Donut patterns ── */}
{donutData.length > 0 && (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-3">Patterns de mouvement</p>
    ...
  </div>
)}
```

- [ ] **Step 3 : Supprimer la section alertes (lignes ~537–572)**

Localiser et supprimer le bloc :

```tsx
{/* ── Alertes ── */}
{result.alerts.length > 0 && (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
    ...
  </div>
)}
```

- [ ] **Step 4 : Supprimer les états et variables devenus inutiles**

Supprimer :
- `const [alertsExpanded, setAlertsExpanded] = useState(false)` (ligne ~184)
- `const shownAlerts = alertsExpanded ? result.alerts.slice(0, 8) : result.alerts.slice(0, 3)` (ligne ~210)
- `const donutData = [...]` (lignes ~203–208) — plus utilisé
- `const PIE_COLORS = [...]` (ligne ~133) — plus utilisé
- La fonction `DonutChart` (lignes ~142–180) — plus utilisée
- Les imports `SEVERITY_ICON`, `SEVERITY_COLOR` si plus utilisés ailleurs dans le fichier

- [ ] **Step 5 : Supprimer le prop `weeks` de la signature (devenu inutile)**

Vérifier qu'il n'est plus utilisé dans le composant, puis le retirer de la destructuration.

- [ ] **Step 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

---

## Task 3 — Ajouter la section Lab en accordéon en bas du panneau

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

La section Lab doit s'insérer **après** la section "Volume par faisceau/séance" et **avant** la fermeture du `{!collapsed && (<>...</>)}`.

- [ ] **Step 1 : Ajouter l'état d'ouverture du Lab**

Après `const [collapsed, setCollapsed] = useState(false)` (ligne ~183), ajouter :

```tsx
const [labOpen, setLabOpen] = useState(false)
const [expandedSubscore, setExpandedSubscore] = useState<string | null>(null)
```

- [ ] **Step 2 : Ajouter les constantes de tooltips subscores**

Après les constantes existantes en haut du fichier (après `SUBSCORE_ACCENT`), ajouter :

```tsx
const SUBSCORE_TOOLTIPS: Record<string, string> = {
  balance: 'Ratio push/pull selon l\'objectif. Un déséquilibre chronique crée des compensations posturales et augmente le risque de blessure à l\'épaule.',
  recovery: 'Fenêtre SRA (Stimulus-Récupération-Adaptation) : temps minimum entre deux sollicitations du même muscle. Trop fréquent = fatigue cumulée sans adaptation.',
  specificity: 'Les exercices correspondent-ils à l\'objectif ? Hypertrophie = 6–15 reps, RIR 1–3, exercices polyarticulaires lourds.',
  progression: 'RIR semaine 1 doit être ≥ 1 pour laisser une marge d\'intensification. Commencer à RIR = 0 = stagnation rapide et surmenage précoce.',
  completeness: 'Patterns de mouvement requis par l\'objectif tous présents ? Hypertrophie = push + pull + jambes + core minimum.',
  redundancy: 'Exercices en doublon (même pattern + mêmes muscles + coeff similaire) diluent le stimulus sans apporter de nouveau signal d\'adaptation.',
  jointLoad: 'Stress cumulé sur épaule, genou et rachis. Croise avec les restrictions du profil client. Un score faible = risque articulaire élevé.',
  coordination: 'Complexité motrice moyenne du programme. Un débutant avec des exercices très techniques risque une mauvaise exécution et des blessures.',
  volumeCoverage: 'Volume hebdomadaire par groupe musculaire comparé aux seuils Israetel/RP : MEV (minimum efficace), MAV (optimal), MRV (maximum récupérable).',
}

const OVERRIDE_TOOLTIPS: Record<string, string> = {
  horizontal_push: 'Multiplie le coefficient stimulus des poussées horizontales (développé couché, dips…)',
  vertical_push: 'Multiplie le coefficient stimulus des poussées verticales (développé militaire, push press…)',
  horizontal_pull: 'Multiplie le coefficient stimulus des tirages horizontaux (rowing, tirage buste penché…)',
  vertical_pull: 'Multiplie le coefficient stimulus des tirages verticaux (traction, tirage poulie haute…)',
  elbow_flexion: 'Multiplie le coefficient stimulus des exercices de biceps (curl barre, curl haltères…)',
  elbow_extension: 'Multiplie le coefficient stimulus des exercices de triceps (extensions, pushdown…)',
  squat_pattern: 'Multiplie le coefficient stimulus des squats (squat barre, goblet squat, leg press…)',
  hip_hinge: 'Multiplie le coefficient stimulus des charnières hanche (soulevé de terre, hip thrust, good morning…)',
  knee_flexion: 'Multiplie le coefficient stimulus des flexions genou (leg curl couché ou assis…)',
  core_flex: 'Multiplie le coefficient stimulus des exercices de flexion abdominale (crunch, relevé de jambes…)',
  core_anti_flex: 'Multiplie le coefficient stimulus du gainage (planche, pallof press, ab wheel…)',
  core_rotation: 'Multiplie le coefficient stimulus des rotations de tronc (russian twist, woodchop…)',
  lateral_raise: 'Multiplie le coefficient stimulus des élévations latérales et exercices épaules isolés',
  calf_raise: 'Multiplie le coefficient stimulus des exercices de mollets',
  scapular_elevation: 'Multiplie le coefficient stimulus des haussements d\'épaules (shrug…)',
}
```

- [ ] **Step 3 : Insérer la section Lab complète**

Juste avant la fermeture `</>` du bloc `{!collapsed && (<>...</>)}`, insérer :

```tsx
{/* ── Section Lab ── */}
<div className="rounded-xl border-[0.3px] border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.03] overflow-hidden">
  {/* Header accordéon */}
  <button
    onClick={() => setLabOpen(v => !v)}
    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#8b5cf6]/[0.04] transition-colors"
  >
    <div className="flex items-center gap-2">
      <FlaskConical size={13} className="text-[#8b5cf6]" />
      <span className="text-[11px] font-semibold text-[#8b5cf6]">Lab Mode</span>
      <span className="text-[9px] text-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-1.5 py-0.5 rounded-full">BETA</span>
      {morphoConnected && (
        <span className="text-[9px] text-[#1f8a65] bg-[#1f8a65]/10 px-1.5 py-0.5 rounded-full">
          Morpho {morphoDate ? `(${morphoDate})` : 'connecté'}
        </span>
      )}
    </div>
    {labOpen
      ? <ChevronUp size={13} className="text-[#8b5cf6]/50" />
      : <ChevronDown size={13} className="text-[#8b5cf6]/50" />
    }
  </button>

  {labOpen && (
    <div className="px-4 pb-4 space-y-4">

      {/* Score global anchor */}
      <div className="flex items-end gap-2 pt-1">
        <span
          className="text-[2rem] font-black leading-none"
          style={{ color: globalColor }}
        >
          {result.globalScore}
        </span>
        <span className="text-[11px] text-white/30 mb-0.5">/100</span>
        <span className="text-[10px] text-white/30 mb-0.5 ml-1">score global</span>
      </div>

      {/* Subscores avec tooltips */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1.5">
          <Microscope size={10} />
          Sous-scores détaillés
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(result.subscores).map(([key, score]) => {
            const labelAccent = key === 'jointLoad' ? '#f97316' : key === 'coordination' ? '#8b5cf6' : key === 'volumeCoverage' ? '#3b82f6' : undefined
            const tooltip = SUBSCORE_TOOLTIPS[key]
            return (
              <div
                key={key}
                className="rounded-lg bg-black/20 px-2.5 py-2 relative"
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <span
                    className="text-[9px] capitalize leading-tight flex-1"
                    style={{ color: labelAccent ? `${labelAccent}99` : 'rgba(255,255,255,0.35)' }}
                  >
                    {SUBSCORE_LABELS[key] ?? key}
                  </span>
                  {tooltip && (
                    <button
                      onClick={() => setExpandedSubscore(expandedSubscore === key ? null : key)}
                      className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
                    >
                      <HelpCircle size={9} />
                    </button>
                  )}
                </div>
                <span
                  className="text-[18px] font-black font-mono leading-none"
                  style={{ color: score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444' }}
                >
                  {Math.round(score)}
                </span>
                {expandedSubscore === key && tooltip && (
                  <p className="text-[9px] text-white/40 mt-1.5 leading-relaxed border-t border-white/[0.06] pt-1.5">
                    {tooltip}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Heatmap fatigue restructurée */}
      {sraHeatmap && sraHeatmap.some(w => w.muscles.length > 0) && (() => {
        const weeks = sraHeatmap
        const allMuscles = Array.from(new Set(weeks.flatMap(w => w.muscles.map(m => m.name))))
        return (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 flex items-center gap-1.5">
                <Zap size={10} />
                Charge musculaire simulée
              </p>
            </div>
            <p className="text-[8px] text-white/20 mb-2 leading-relaxed">
              Simulation statique — même programme répété 4 semaines · surcharge progressive à venir
            </p>
            {/* Légende */}
            <div className="flex items-center gap-3 mb-2">
              {[
                { color: '#1f8a65', label: 'Optimal (<30%)' },
                { color: '#f59e0b', label: 'Élevé (30–60%)' },
                { color: '#ef4444', label: 'Critique (>60%)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
                  <span className="text-[8px] text-white/30">{label}</span>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead>
                  <tr>
                    <th className="text-left text-white/25 pr-2 pb-1 font-normal">Muscle</th>
                    {weeks.map(w => (
                      <th key={w.week} className="text-center text-white/25 px-1 pb-1 font-normal w-12">S{w.week}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allMuscles.map(muscle => (
                    <tr key={muscle}>
                      <td className="text-white/40 pr-2 py-0.5 capitalize">{muscle}</td>
                      {weeks.map(week => {
                        const entry = week.muscles.find(x => x.name === muscle)
                        const fatigue = entry?.fatigue ?? 0
                        const bg = fatigue > 60 ? 'rgba(239,68,68,0.3)' : fatigue > 30 ? 'rgba(245,158,11,0.25)' : fatigue > 0 ? 'rgba(31,138,101,0.2)' : 'rgba(255,255,255,0.02)'
                        return (
                          <td key={week.week} className="px-1 py-0.5">
                            <div
                              className="h-4 rounded"
                              style={{ backgroundColor: bg }}
                              title={fatigue > 0 ? `${fatigue}%` : '—'}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Overrides coefficients */}
      {presentPatterns && presentPatterns.length > 0 && onOverrideChange && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 flex items-center gap-1.5">
              <Sliders size={10} />
              Overrides coefficients
            </p>
            {onOverrideReset && Object.keys(labOverrides ?? {}).some(k => (labOverrides ?? {})[k] !== 1.0) && (
              <button
                onClick={onOverrideReset}
                className="text-[9px] text-[#8b5cf6]/60 hover:text-[#8b5cf6] transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-[8px] text-white/20 mb-2 leading-relaxed">
            Multiplie le coefficient stimulus de tous les exercices d'un pattern. Utile pour corriger des exercices non enrichis ou adapter à l'activation réelle du client.
          </p>
          <div className="space-y-2">
            {presentPatterns.map(pattern => {
              const currentVal = (labOverrides ?? {})[pattern] ?? 1.0
              const tooltip = OVERRIDE_TOOLTIPS[pattern]
              return (
                <div key={pattern}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 w-32 shrink-0 truncate capitalize">
                      {pattern.replace(/_/g, ' ')}
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={currentVal}
                      onChange={e => onOverrideChange(pattern, parseFloat(e.target.value))}
                      className="flex-1 accent-[#8b5cf6] h-1"
                    />
                    <span
                      className="text-[9px] font-mono w-8 text-right shrink-0"
                      style={{ color: currentVal !== 1.0 ? '#8b5cf6' : 'rgba(255,255,255,0.3)' }}
                    >
                      {currentVal.toFixed(2)}
                    </span>
                  </div>
                  {tooltip && (
                    <p className="text-[8px] text-white/20 ml-32 mt-0.5 leading-relaxed pl-2">{tooltip}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Badge Morpho */}
      <div className="pt-1 border-t border-white/[0.04]">
        {morphoConnected ? (
          <p className="text-[9px] text-[#1f8a65]/70 leading-relaxed">
            Ajustements morpho actifs{morphoDate ? ` (analyse du ${morphoDate})` : ''} — les coefficients stimulus sont modulés par les asymétries mesurées.
          </p>
        ) : (
          <p className="text-[9px] text-white/25 leading-relaxed">
            Aucune analyse morpho disponible — coefficients standards du catalogue.
          </p>
        )}
      </div>

    </div>
  )}
</div>
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Attendu : possibles erreurs sur `ChevronUp`/`ChevronDown` si non importés — les ajouter si besoin.

---

## Task 4 — Mettre à jour IntelligencePanelShell

**Files:**
- Modify: `components/programs/studio/IntelligencePanelShell.tsx`

- [ ] **Step 1 : Retirer l'import de LabModeSection**

Supprimer la ligne :
```tsx
import LabModeSection from './LabModeSection'
```

- [ ] **Step 2 : Mettre à jour l'interface Props**

Remplacer l'interface Props existante (lignes 12–24) par :

```tsx
interface Props {
  result: IntelligenceResult
  meta: TemplateMeta
  onAlertClick: (si: number, ei: number) => void
  morphoConnected?: boolean
  morphoDate?: string
  sraHeatmap?: SRAHeatmapWeek[]
  labOverrides?: Record<string, number>
  presentPatterns?: string[]
  onOverrideChange?: (pattern: string, value: number) => void
  onOverrideReset?: () => void
}
```

- [ ] **Step 3 : Mettre à jour la destructuration de la fonction**

Remplacer la ligne 26–29 :
```tsx
export default function IntelligencePanelShell({
  result, weeks, meta, onAlertClick,
  morphoConnected, morphoDate, sraHeatmap, labOverrides, presentPatterns,
  onOverrideChange, onOverrideReset,
}: Props) {
```

par :
```tsx
export default function IntelligencePanelShell({
  result, meta, onAlertClick,
  morphoConnected, morphoDate, sraHeatmap, labOverrides, presentPatterns,
  onOverrideChange, onOverrideReset,
}: Props) {
```

- [ ] **Step 4 : Supprimer le render de LabModeSection dans le mode docked (lignes ~138–147)**

Remplacer le bloc :
```tsx
<div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
  <ProgramIntelligencePanel result={result} weeks={weeks} meta={meta} onAlertClick={onAlertClick} />
  <LabModeSection
    result={result}
    morphoConnected={morphoConnected ?? false}
    morphoDate={morphoDate}
    sraHeatmap={sraHeatmap}
    labOverrides={labOverrides}
    presentPatterns={presentPatterns}
    onOverrideChange={onOverrideChange}
    onOverrideReset={onOverrideReset}
  />
</div>
```

par :
```tsx
<div className="flex-1 overflow-y-auto px-3 py-3">
  <ProgramIntelligencePanel
    result={result}
    meta={meta}
    onAlertClick={onAlertClick}
    morphoConnected={morphoConnected}
    morphoDate={morphoDate}
    sraHeatmap={sraHeatmap}
    labOverrides={labOverrides}
    presentPatterns={presentPatterns}
    onOverrideChange={onOverrideChange}
    onOverrideReset={onOverrideReset}
  />
</div>
```

- [ ] **Step 5 : Mettre à jour le render floating (ligne ~104)**

Remplacer :
```tsx
<ProgramIntelligencePanel result={result} weeks={weeks} meta={meta} onAlertClick={onAlertClick} />
```

par :
```tsx
<ProgramIntelligencePanel
  result={result}
  meta={meta}
  onAlertClick={onAlertClick}
  morphoConnected={morphoConnected}
  morphoDate={morphoDate}
  sraHeatmap={sraHeatmap}
  labOverrides={labOverrides}
  presentPatterns={presentPatterns}
  onOverrideChange={onOverrideChange}
  onOverrideReset={onOverrideReset}
/>
```

- [ ] **Step 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

---

## Task 5 — Supprimer LabModeSection.tsx

**Files:**
- Delete: `components/programs/studio/LabModeSection.tsx`

- [ ] **Step 1 : Vérifier qu'aucun autre fichier n'importe LabModeSection**

```bash
grep -r "LabModeSection" /Users/user/Desktop/VIRTUS --include="*.tsx" --include="*.ts"
```

Attendu : aucun résultat (après les modifications des tasks précédentes).

- [ ] **Step 2 : Supprimer le fichier**

```bash
rm /Users/user/Desktop/VIRTUS/components/programs/studio/LabModeSection.tsx
```

- [ ] **Step 3 : Vérifier TypeScript complet**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Attendu : 0 erreurs.

---

## Task 6 — Vérifier le wiring dans ProgramTemplateBuilder

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx` (vérification uniquement, probablement aucun changement)

- [ ] **Step 1 : Vérifier que le prop `weeks` n'est plus passé à IntelligencePanelShell**

```bash
grep -n "weeks=" /Users/user/Desktop/VIRTUS/components/programs/ProgramTemplateBuilder.tsx
```

Si une ligne contient `weeks={...}` dans le render de `IntelligencePanelShell`, la supprimer.

- [ ] **Step 2 : Vérifier que morphoDate est bien passé si disponible**

```bash
grep -n "morphoDate\|morpho_date\|analysis_date" /Users/user/Desktop/VIRTUS/components/programs/ProgramTemplateBuilder.tsx
```

Si `morphoDate` n'est pas passé à `IntelligencePanelShell`, localiser où `morphoAdjustments` est chargé (fetch `/api/clients/[clientId]/morpho/latest`) et extraire `analysis_date` pour le passer :

```tsx
// Chercher le fetch morpho/latest existant et extraire la date
const [morphoDate, setMorphoDate] = useState<string | undefined>(undefined)

// Dans le useEffect qui fetch morpho/latest :
if (data.analysis_date) {
  setMorphoDate(new Date(data.analysis_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }))
}
```

Puis passer `morphoDate={morphoDate}` à `IntelligencePanelShell`.

- [ ] **Step 3 : Vérifier TypeScript final**

```bash
npx tsc --noEmit
```

Attendu : **0 erreurs**.

---

## Task 7 — Vérifier visuellement et mettre à jour la documentation

- [ ] **Step 1 : Vérifier que le build passe**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 2 : Mettre à jour CHANGELOG.md**

Ajouter en tête de la section du jour :

```
## 2026-04-26

REFACTOR: Merge ProgramIntelligencePanel + LabModeSection into single unified panel
REFACTOR: Remove duplicate subscores grid from SmartFit main panel
REFACTOR: Remove alerts from SmartFit panel (kept only as inline exercise badges)
REFACTOR: Remove donut patterns chart from SmartFit panel
FEATURE: Add Lab Mode accordion section with subscore tooltips, heatmap legend, override descriptions
```

- [ ] **Step 3 : Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx \
        components/programs/studio/IntelligencePanelShell.tsx \
        components/programs/ProgramTemplateBuilder.tsx \
        CHANGELOG.md
git commit -m "$(cat <<'EOF'
refactor(smartfit): merge ProgramIntelligencePanel + LabModeSection into unified panel

- Remove duplicate subscores grid from main panel
- Remove alerts from panel (inline badges only)
- Remove donut patterns chart
- Add Lab Mode accordion with subscore tooltips, heatmap legend, override descriptions
- Delete LabModeSection.tsx

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage :**
- ✅ Fusion panneau unique — Tasks 1–4
- ✅ Suppression grille subscores — Task 2
- ✅ Suppression alertes panneau — Task 2
- ✅ Suppression donut patterns — Task 2
- ✅ Lab Mode accordéon fermé par défaut — Task 3 (`useState(false)`)
- ✅ Score global dans Lab — Task 3
- ✅ Subscores avec tooltips — Task 3
- ✅ Heatmap avec légende et note explicative — Task 3
- ✅ Heatmap cellules colorées sans chiffres bruts — Task 3
- ✅ Overrides avec description globale et tooltip par slider — Task 3
- ✅ Badge Morpho dans Lab — Task 3
- ✅ Suppression LabModeSection.tsx — Task 5
- ✅ Nettoyage wiring ProgramTemplateBuilder — Task 6

**Placeholder scan :** Aucun TBD, TODO, "implement later" dans le plan.

**Type consistency :**
- `SRAHeatmapWeek` importé dans Task 1, utilisé dans Task 3 — cohérent
- `labOverrides?: Record<string, number>` — même type partout
- `presentPatterns?: string[]` — même type partout
- `SUBSCORE_LABELS` déjà défini dans le fichier existant, réutilisé dans Task 3 — cohérent
- `globalColor` déjà calculé dans le composant existant, réutilisé dans Task 3 — cohérent
- `Zap` déjà importé existant, `FlaskConical`, `Microscope`, `HelpCircle`, `Sliders` ajoutés en Task 1
- `ChevronUp`/`ChevronDown` déjà importés dans le fichier existant
