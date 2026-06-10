# Session & Exercise Reordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop + arrow reordering for sessions (mode Cycle) and exercises (all modes), with bidirectional sync between NavigatorPane and EditorPane.

**Architecture:** Single `DndContext` at ProgramTemplateBuilder level wraps both NavigatorPane and EditorPane. `session_mode: 'day' | 'cycle'` is added to the template (DB + UI). Sessions in day-mode auto-sort by `day_of_week`; in cycle-mode they are freely reorderable via DnD + arrows. Exercises are always reorderable (intra- and inter-session). State mutations happen in ProgramTemplateBuilder and flow down as props.

**Tech Stack:** `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), Next.js App Router, TypeScript strict, Supabase SQL migration.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260419_template_session_mode.sql` | Create | Add `session_mode` column to `coach_program_templates` |
| `components/programs/ProgramTemplateBuilder.tsx` | Modify | Add `sessionMode` state, reorder handlers (`moveSession`, `moveExercise`), DndContext wrapper, sync scroll |
| `components/programs/studio/NavigatorPane.tsx` | Modify | Add SortableContext for sessions (cycle mode) + exercises, drag handles, up/down arrows, emit reorder callbacks |
| `components/programs/studio/EditorPane.tsx` | Modify | Add SortableContext per session for exercises, drag handles on ExerciseCard, up/down arrows on session headers (cycle) + exercise headers |
| `components/programs/studio/ExerciseCard.tsx` | Modify | Accept `dragHandleProps`, `onMoveUp`, `onMoveDown`, `isFirst`, `isLast` props; render grip handle + arrows |

---

## Task 1: DB migration — add `session_mode`

**Files:**
- Create: `supabase/migrations/20260419_template_session_mode.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419_template_session_mode.sql
alter table public.coach_program_templates
  add column if not exists session_mode text not null default 'day'
  check (session_mode in ('day', 'cycle'));
```

- [ ] **Step 2: Apply in Supabase dashboard or local CLI**

```bash
# If using Supabase CLI locally:
supabase db push
# Or paste the SQL directly in the Supabase dashboard SQL editor
```

Expected: column `session_mode` added with default `'day'`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260419_template_session_mode.sql
git commit -m "schema: add session_mode to coach_program_templates (day | cycle)"
```

---

## Task 2: Core reorder logic in ProgramTemplateBuilder

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

This task adds `sessionMode` state, the `moveSession` / `moveExercise` functions, and threads them as props to child panes. No DnD wiring yet — just the pure state logic.

- [ ] **Step 1: Add `sessionMode` to state and `TemplateMeta` interface**

In `ProgramTemplateBuilder.tsx`, find the `TemplateMeta` interface and add:

```typescript
interface TemplateMeta {
  name: string;
  description: string;
  goal: string;
  level: string;
  frequency: number;
  weeks: number;
  muscle_tags: string[];
  notes: string;
  equipment_archetype: string;
  session_mode: 'day' | 'cycle'; // NEW
}
```

Update `emptySession` is unchanged. Update the initial `meta` state — find the two places where `setMeta` initial value is computed (with `initial` prop and without) and add `session_mode`:

```typescript
// With initial prop:
session_mode: (initial?.session_mode ?? 'day') as 'day' | 'cycle',

// Without initial prop (new template):
session_mode: 'day',
```

- [ ] **Step 2: Auto-sort sessions in day mode**

Add a derived value right after the `sessions` state declaration:

```typescript
const orderedSessions = meta.session_mode === 'day'
  ? [...sessions].sort((a, b) => {
      const aDay = a.day_of_week ?? 99
      const bDay = b.day_of_week ?? 99
      return aDay - bDay
    })
  : sessions
```

Replace every use of `sessions` in the JSX render (the NavigatorPane + EditorPane props) with `orderedSessions`. Keep `sessions` (raw) for all mutation functions — they operate on raw index.

> ⚠️ Important: `orderedSessions` is read-only for rendering. All `setSessions` calls still work on the raw `sessions` array. Index conversions happen via a helper (next step).

- [ ] **Step 3: Add index translation helper**

When the UI operates on `orderedSessions[si]`, we need to find that session's real index in `sessions`. Add this helper:

```typescript
function rawSessionIndex(orderedSi: number): number {
  const target = orderedSessions[orderedSi]
  return sessions.indexOf(target)
}
```

Update all callbacks passed to `NavigatorPane` and `EditorPane` that use `si` to first call `rawSessionIndex(si)`:

```typescript
// Example — onUpdateSession:
onUpdateSession={(si, patch) => updateSession(rawSessionIndex(si), patch)}
onRemoveSession={(si) => removeSession(rawSessionIndex(si))}
onAddExercise={(si) => addExercise(rawSessionIndex(si))}
onRemoveExercise={(si, ei) => removeExercise(rawSessionIndex(si), ei)}
onUpdateExercise={(si, ei, patch) => updateExercise(rawSessionIndex(si), ei, patch)}
onImageUpload={(si, ei, file) => handleImageUpload(rawSessionIndex(si), ei, file)}
onPickExercise={(si, ei) => setPickerTarget({ si: rawSessionIndex(si), ei })}
onOpenAlternatives={(si, ei) => setAlternativesTarget({ si: rawSessionIndex(si), ei })}
onToggleSuperset={(si, ei) => toggleSuperset(rawSessionIndex(si), ei)}
```

- [ ] **Step 4: Add `moveSession` function (cycle mode only)**

```typescript
function moveSession(fromSi: number, toSi: number) {
  if (fromSi === toSi) return
  setSessions(prev => {
    const next = [...prev]
    const [moved] = next.splice(fromSi, 1)
    next.splice(toSi, 0, moved)
    return next
  })
}
```

- [ ] **Step 5: Add `moveExercise` function (intra + inter session)**

```typescript
function moveExercise(
  fromSi: number, fromEi: number,
  toSi: number, toEi: number
) {
  if (fromSi === toSi && fromEi === toEi) return
  setSessions(prev => {
    const next = prev.map(s => ({ ...s, exercises: [...s.exercises] }))
    const [moved] = next[fromSi].exercises.splice(fromEi, 1)
    next[toSi].exercises.splice(toEi, 0, moved)
    return next
  })
}
```

- [ ] **Step 6: Include `session_mode` in save payload**

In `handleSave`, find the `payload` object and add:

```typescript
const payload = {
  ...meta,          // already includes session_mode via spread
  sessions: sessions.map((s) => ({
    name: s.name,
    day_of_week: s.day_of_week,
    notes: s.notes,
    exercises: s.exercises,
  })),
};
```

`meta` already includes `session_mode` after Step 1, so the spread covers it.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(builder): add sessionMode state + moveSession/moveExercise handlers"
```

---

## Task 3: Session mode toggle in EditorPane header

**Files:**
- Modify: `components/programs/studio/EditorPane.tsx`

Add a toggle `Jour | Cycle` in the meta row of EditorPane, and pass `sessionMode` as a prop.

- [ ] **Step 1: Add `sessionMode` + `onSessionModeChange` to EditorPane Props**

Find the `Props` interface in `EditorPane.tsx` and add:

```typescript
sessionMode: 'day' | 'cycle'
onSessionModeChange: (mode: 'day' | 'cycle') => void
```

- [ ] **Step 2: Add the toggle in the meta row**

In the meta row section (after the `weeks` input, before the closing `</div>`), add:

```tsx
{/* Session mode toggle */}
<div className="flex items-center rounded-lg overflow-hidden border-[0.3px] border-white/[0.06] shrink-0">
  {(['day', 'cycle'] as const).map(mode => (
    <button
      key={mode}
      onClick={() => onSessionModeChange(mode)}
      className={[
        'h-7 px-3 text-[10px] font-semibold transition-colors',
        sessionMode === mode
          ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
          : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]',
      ].join(' ')}
    >
      {mode === 'day' ? 'Jours' : 'Cycle'}
    </button>
  ))}
</div>
```

- [ ] **Step 3: In session headers, hide day-of-week pills in cycle mode**

Find the day-of-week section in the session header map:

```tsx
{/* Day of week — only in day mode */}
{sessionMode === 'day' && (
  <div className="flex items-center gap-1">
    {DAYS.map((d, idx) => (
      // ... existing code unchanged
    ))}
  </div>
)}
{/* Cycle mode: show session number badge instead */}
{sessionMode === 'cycle' && (
  <span className="text-[10px] font-mono text-white/25 shrink-0">
    S{si + 1}
  </span>
)}
```

- [ ] **Step 4: Wire props in ProgramTemplateBuilder**

In `ProgramTemplateBuilder.tsx`, add these two props to the `<EditorPane>` component:

```tsx
sessionMode={meta.session_mode}
onSessionModeChange={mode => setMeta(m => ({ ...m, session_mode: mode }))}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/programs/studio/EditorPane.tsx components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(editor): add Jours/Cycle session mode toggle in EditorPane header"
```

---

## Task 4: Arrow reordering on sessions (cycle mode) in EditorPane

**Files:**
- Modify: `components/programs/studio/EditorPane.tsx`

- [ ] **Step 1: Add `onMoveSession` prop**

Add to the `Props` interface:

```typescript
onMoveSession: (fromSi: number, toSi: number) => void
```

- [ ] **Step 2: Add up/down arrows in session header (cycle mode only)**

In the session header, after the collapse button and before the name input, add arrows visible only in cycle mode:

```tsx
{sessionMode === 'cycle' && (
  <div className="flex flex-col gap-0.5 shrink-0">
    <button
      onClick={() => onMoveSession(si, si - 1)}
      disabled={si === 0}
      className="p-0.5 rounded text-white/20 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
    >
      <ChevronUp size={10} />
    </button>
    <button
      onClick={() => onMoveSession(si, si + 1)}
      disabled={si === sessions.length - 1}
      className="p-0.5 rounded text-white/20 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
    >
      <ChevronDown size={10} />
    </button>
  </div>
)}
```

- [ ] **Step 3: Wire prop in ProgramTemplateBuilder**

```tsx
onMoveSession={(fromSi, toSi) => {
  const rawFrom = rawSessionIndex(fromSi)
  const rawTo = rawSessionIndex(toSi)
  moveSession(rawFrom, rawTo)
}}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/programs/studio/EditorPane.tsx components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(editor): session up/down arrows in cycle mode"
```

---

## Task 5: Arrow reordering on exercises in EditorPane + ExerciseCard

**Files:**
- Modify: `components/programs/studio/EditorPane.tsx`
- Modify: `components/programs/studio/ExerciseCard.tsx`

- [ ] **Step 1: Add `onMoveExercise` prop to EditorPane**

```typescript
onMoveExercise: (fromSi: number, fromEi: number, toSi: number, toEi: number) => void
```

- [ ] **Step 2: Add `onMoveUp` / `onMoveDown` props to ExerciseCard**

In `ExerciseCard.tsx`, find the props interface and add:

```typescript
onMoveUp?: () => void
onMoveDown?: () => void
isFirst?: boolean
isLast?: boolean
```

- [ ] **Step 3: Render up/down arrows in ExerciseCard header**

In `ExerciseCard.tsx`, in the card header area (where `Trash2` button is), add before the trash button:

```tsx
<div className="flex items-center gap-0.5 shrink-0">
  <button
    onClick={onMoveUp}
    disabled={isFirst}
    className="p-1 rounded text-white/20 hover:text-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
    title="Monter"
  >
    <ChevronUp size={11} />
  </button>
  <button
    onClick={onMoveDown}
    disabled={isLast}
    className="p-1 rounded text-white/20 hover:text-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
    title="Descendre"
  >
    <ChevronDown size={11} />
  </button>
</div>
```

Add `ChevronUp, ChevronDown` to the imports from `lucide-react` in ExerciseCard.tsx.

- [ ] **Step 4: Compute move direction logic in EditorPane and pass callbacks**

In `EditorPane.tsx`, update the `ExerciseCard` render inside `session.exercises.map`:

```tsx
<ExerciseCard
  // ... existing props unchanged ...
  isFirst={ei === 0 && si === 0}
  isLast={ei === session.exercises.length - 1 && si === sessions.length - 1}
  onMoveUp={() => {
    if (ei > 0) {
      onMoveExercise(si, ei, si, ei - 1)
    } else if (si > 0) {
      // Move to end of previous session
      const prevSessionExCount = sessions[si - 1].exercises.length
      onMoveExercise(si, ei, si - 1, prevSessionExCount)
    }
  }}
  onMoveDown={() => {
    if (ei < session.exercises.length - 1) {
      onMoveExercise(si, ei, si, ei + 1)
    } else if (si < sessions.length - 1) {
      // Move to start of next session
      onMoveExercise(si, ei, si + 1, 0)
    }
  }}
/>
```

- [ ] **Step 5: Wire prop in ProgramTemplateBuilder**

```tsx
onMoveExercise={(fromSi, fromEi, toSi, toEi) =>
  moveExercise(rawSessionIndex(fromSi), fromEi, rawSessionIndex(toSi), toEi)
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add components/programs/studio/EditorPane.tsx components/programs/studio/ExerciseCard.tsx components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(editor): exercise up/down arrows (intra + inter session)"
```

---

## Task 6: DnD on exercises in EditorPane (intra + inter session)

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`
- Modify: `components/programs/studio/EditorPane.tsx`
- Modify: `components/programs/studio/ExerciseCard.tsx`

This task adds drag-and-drop via `@dnd-kit` for exercises. Sessions DnD (cycle mode) comes in Task 7.

- [ ] **Step 1: Understand the dnd-kit IDs scheme**

Each draggable item needs a unique string ID. We'll use:
- Exercise drag ID: `"ex-${si}-${ei}"` — encodes session index + exercise index
- Session droppable ID: `"session-${si}"`

Parse helpers (add at top of ProgramTemplateBuilder.tsx):

```typescript
function makeExId(si: number, ei: number) { return `ex-${si}-${ei}` }
function parseExId(id: string): { si: number; ei: number } {
  const [, si, ei] = id.split('-')
  return { si: Number(si), ei: Number(ei) }
}
```

- [ ] **Step 2: Add DndContext + sensors in ProgramTemplateBuilder**

Add imports at top:

```typescript
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
```

Add sensors setup inside the component (after state declarations):

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
)
```

The `distance: 5` prevents accidental drags when clicking buttons inside cards.

- [ ] **Step 3: Add `handleDragEnd` in ProgramTemplateBuilder**

```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const activeId = String(active.id)
  const overId = String(over.id)

  // Exercise over exercise
  if (activeId.startsWith('ex-') && overId.startsWith('ex-')) {
    const from = parseExId(activeId)
    const to = parseExId(overId)
    moveExercise(rawSessionIndex(from.si), from.ei, rawSessionIndex(to.si), to.ei)
    return
  }

  // Exercise dropped onto a session container (empty session)
  if (activeId.startsWith('ex-') && overId.startsWith('session-')) {
    const from = parseExId(activeId)
    const toSi = Number(overId.replace('session-', ''))
    const toEi = orderedSessions[toSi].exercises.length
    moveExercise(rawSessionIndex(from.si), from.ei, rawSessionIndex(toSi), toEi)
  }
}
```

- [ ] **Step 4: Wrap render in DndContext**

In the `return` of `ProgramTemplateBuilder`, wrap the entire `<div className="h-[calc(100vh-96px)]...">` with:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  {/* existing content */}
</DndContext>
```

- [ ] **Step 5: Pass DnD props to EditorPane**

Add to `EditorPane` Props interface:

```typescript
makeExDragId: (si: number, ei: number) => string
sessionDropId: (si: number) => string
```

Wire in ProgramTemplateBuilder:

```tsx
makeExDragId={makeExId}
sessionDropId={si => `session-${si}`}
```

- [ ] **Step 6: Add SortableContext per session in EditorPane**

Add imports to `EditorPane.tsx`:

```typescript
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
```

Create a wrapper component at the bottom of the file (outside `EditorPane`):

```tsx
function DroppableSession({
  id, children, className,
}: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className={className}>{children}</div>
}
```

In the exercises section of each session, replace:

```tsx
<div className="p-4 space-y-3">
  {session.exercises.map(...)}
```

with:

```tsx
<DroppableSession id={sessionDropId(si)} className="p-4 space-y-3">
  <SortableContext
    items={session.exercises.map((_, ei) => makeExDragId(si, ei))}
    strategy={verticalListSortingStrategy}
  >
    {session.exercises.map(...)}
  </SortableContext>
</DroppableSession>
```

- [ ] **Step 7: Make ExerciseCard sortable**

Add imports to `ExerciseCard.tsx`:

```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Add `dragId` prop to ExerciseCard's Props interface:

```typescript
dragId: string
```

Inside ExerciseCard component body, add:

```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: dragId })

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
  position: isDragging ? 'relative' as const : undefined,
  zIndex: isDragging ? 50 : undefined,
}
```

Wrap the outermost card div with `ref={setNodeRef}` and `style={style}`:

```tsx
<div
  ref={setNodeRef}
  style={style}
  className={[
    'rounded-xl border-[0.3px] ...',
    // existing classes
  ].join(' ')}
>
```

Add a grip handle element in the card header (top-left corner), using `{...attributes} {...listeners}`:

```tsx
<div
  {...attributes}
  {...listeners}
  className="cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/50 transition-colors shrink-0"
  title="Déplacer"
>
  <GripVertical size={13} />
</div>
```

Add `GripVertical` to imports from `lucide-react` in ExerciseCard.

- [ ] **Step 8: Pass `dragId` from EditorPane to ExerciseCard**

In EditorPane, update the ExerciseCard render:

```tsx
<ExerciseCard
  dragId={makeExDragId(si, ei)}
  // ... all other existing props
/>
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx components/programs/studio/EditorPane.tsx components/programs/studio/ExerciseCard.tsx
git commit -m "feat(dnd): drag-and-drop exercises intra + inter session via @dnd-kit"
```

---

## Task 7: DnD on sessions in NavigatorPane (cycle mode)

**Files:**
- Modify: `components/programs/studio/NavigatorPane.tsx`
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

- [ ] **Step 1: Add reorder callbacks to NavigatorPane Props**

In `NavigatorPane.tsx`, update the `Props` interface:

```typescript
interface Props {
  sessions: NavSession[]
  activeSessionIndex: number | null
  activeExerciseKey: string | null
  sessionMode: 'day' | 'cycle'            // NEW
  onSelectSession: (si: number) => void
  onSelectExercise: (si: number, ei: number) => void
  onAddSession: () => void
  onMoveSession: (fromSi: number, toSi: number) => void      // NEW
  onMoveExercise: (fromSi: number, fromEi: number, toSi: number, toEi: number) => void  // NEW
}
```

- [ ] **Step 2: Add SortableContext for sessions in NavigatorPane (cycle mode)**

Add imports:

```typescript
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
```

Create a `SortableSessionRow` component at the bottom of the file:

```tsx
function SortableSessionRow({
  session, si, isActive, isExpanded, sessionMode,
  onSelect, onToggle, exerciseCount,
  children,
}: {
  session: NavSession
  si: number
  isActive: boolean
  isExpanded: boolean
  sessionMode: 'day' | 'cycle'
  onSelect: () => void
  onToggle: () => void
  exerciseCount: number
  children: React.ReactNode
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `nav-session-${si}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-0.5">
      <button
        onClick={() => { onSelect(); onToggle() }}
        className={[
          'w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors group',
          isActive
            ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
            : 'text-white/70 hover:bg-white/[0.03] hover:text-white/90',
        ].join(' ')}
      >
        {/* Drag handle — only in cycle mode */}
        {sessionMode === 'cycle' && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={10} />
          </span>
        )}
        {isExpanded
          ? <ChevronDown size={11} className="shrink-0 opacity-50" />
          : <ChevronRight size={11} className="shrink-0 opacity-50" />
        }
        <span className="text-[11px] font-medium truncate flex-1" title={session.name || `Séance ${si + 1}`}>
          {session.name || `Séance ${si + 1}`}
        </span>
        <span className="text-[9px] text-white/25 shrink-0">{exerciseCount}</span>
      </button>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Replace session rows in NavigatorPane with SortableSessionRow**

In the `NavigatorPane` render, replace:

```tsx
{sessions.map((session, si) => {
  const isExpanded = expandedSessions[si] ?? true
  const isActive = activeSessionIndex === si
  return (
    <div key={si} className="mb-0.5">
      <button ...>
        <GripVertical ... />
        ...
      </button>
      {/* Exercises */}
      ...
    </div>
  )
})}
```

with:

```tsx
<SortableContext
  items={sessions.map((_, si) => `nav-session-${si}`)}
  strategy={verticalListSortingStrategy}
>
  {sessions.map((session, si) => {
    const isExpanded = expandedSessions[si] ?? true
    const isActive = activeSessionIndex === si
    return (
      <SortableSessionRow
        key={si}
        session={session}
        si={si}
        isActive={isActive}
        isExpanded={isExpanded}
        sessionMode={sessionMode}
        onSelect={() => onSelectSession(si)}
        onToggle={() => toggleSession(si)}
        exerciseCount={session.exercises.length}
      >
        {/* Exercises */}
        {isExpanded && session.exercises.map((ex, ei) => {
          const key = `${si}-${ei}`
          const isActiveEx = activeExerciseKey === key
          return (
            <button
              key={ei}
              onClick={() => onSelectExercise(si, ei)}
              className={[
                'w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors',
                isActiveEx
                  ? 'bg-[#1f8a65]/5 text-[#1f8a65]/80'
                  : 'text-white/40 hover:bg-white/[0.02] hover:text-white/60',
              ].join(' ')}
            >
              <Dumbbell size={9} className="shrink-0 opacity-60" />
              <span className="text-[10px] truncate" title={ex.name || `Exercice ${ei + 1}`}>
                {ex.name || `Exercice ${ei + 1}`}
              </span>
            </button>
          )
        })}
      </SortableSessionRow>
    )
  })}
</SortableContext>
```

- [ ] **Step 4: Add up/down arrows on sessions in NavigatorPane (cycle mode)**

Inside `SortableSessionRow`, after the drag handle span, add arrow buttons in cycle mode:

```tsx
{sessionMode === 'cycle' && (
  <div className="flex flex-col gap-0 shrink-0 ml-0.5">
    <button
      onClick={e => { e.stopPropagation(); /* handled via prop */ }}
      className="p-0.5 text-white/20 hover:text-white/50 disabled:opacity-10 transition-colors"
    >
      <ChevronUp size={8} />
    </button>
    <button
      onClick={e => { e.stopPropagation(); }}
      className="p-0.5 text-white/20 hover:text-white/50 disabled:opacity-10 transition-colors"
    >
      <ChevronDown size={8} />
    </button>
  </div>
)}
```

Pass `onMoveUp` / `onMoveDown` as props to `SortableSessionRow` and wire them:

```typescript
// Add to SortableSessionRow props:
onMoveUp?: () => void
onMoveDown?: () => void

// In the buttons:
onClick={e => { e.stopPropagation(); onMoveUp?.() }}
onClick={e => { e.stopPropagation(); onMoveDown?.() }}
```

In the NavigatorPane parent, pass:

```tsx
onMoveUp={si > 0 ? () => onMoveSession(si, si - 1) : undefined}
onMoveDown={si < sessions.length - 1 ? () => onMoveSession(si, si + 1) : undefined}
```

- [ ] **Step 5: Wire new NavigatorPane props in ProgramTemplateBuilder**

```tsx
<NavigatorPane
  sessions={navSessions}
  activeSessionIndex={null}
  activeExerciseKey={highlightKey}
  sessionMode={meta.session_mode}
  onSelectSession={si => {
    const el = exerciseRefs.current[`${si}-0`]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }}
  onSelectExercise={(si, ei) => handleAlertClick(si, ei)}
  onAddSession={() => setSessions(prev => [...prev, emptySession()])}
  onMoveSession={(fromSi, toSi) => moveSession(fromSi, toSi)}
  onMoveExercise={(fromSi, fromEi, toSi, toEi) =>
    moveExercise(rawSessionIndex(fromSi), fromEi, rawSessionIndex(toSi), toEi)
  }
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add components/programs/studio/NavigatorPane.tsx components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(navigator): sortable session rows + arrows in cycle mode"
```

---

## Task 8: Sync scroll — EditorPane scrolls to moved element

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

When an exercise is moved (via arrow or DnD), the EditorPane should scroll to it.

- [ ] **Step 1: Wrap `moveExercise` with scroll side-effect**

Replace the existing `moveExercise` function with:

```typescript
function moveExercise(
  fromSi: number, fromEi: number,
  toSi: number, toEi: number
) {
  if (fromSi === toSi && fromEi === toEi) return
  setSessions(prev => {
    const next = prev.map(s => ({ ...s, exercises: [...s.exercises] }))
    const [moved] = next[fromSi].exercises.splice(fromEi, 1)
    next[toSi].exercises.splice(toEi, 0, moved)
    return next
  })
  // Scroll to destination after state updates
  setTimeout(() => {
    const key = `${toSi}-${toEi}`
    const el = exerciseRefs.current[key]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setHighlightKey(key)
      setTimeout(() => setHighlightKey(null), 1200)
    }
  }, 50)
}
```

- [ ] **Step 2: Wrap `moveSession` with scroll side-effect (cycle mode)**

```typescript
function moveSession(fromSi: number, toSi: number) {
  if (fromSi === toSi) return
  setSessions(prev => {
    const next = [...prev]
    const [moved] = next.splice(fromSi, 1)
    next.splice(toSi, 0, moved)
    return next
  })
  // Scroll to moved session's first exercise
  setTimeout(() => {
    const el = exerciseRefs.current[`${toSi}-0`]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(builder): scroll to moved element after reorder"
```

---

## Task 9: CHANGELOG + project-state update

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top of today's section (`## 2026-04-19`):

```
FEATURE: Add session_mode (day/cycle) toggle to program template builder
FEATURE: Exercise drag-and-drop via @dnd-kit (intra + inter session) in EditorPane
FEATURE: Session drag-and-drop via @dnd-kit in NavigatorPane (cycle mode only)
FEATURE: Up/down arrows on sessions (cycle mode) and exercises (all modes)
FEATURE: Auto-sort sessions by day_of_week in day mode
FEATURE: Scroll-to + highlight after move in EditorPane
SCHEMA: Add session_mode column to coach_program_templates
```

- [ ] **Step 2: Update project-state.md**

Add a new dated section `## 2026-04-19 — Session & Exercise Reordering` documenting what was built, key invariants, and next steps.

- [ ] **Step 3: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Final commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG + project-state for session/exercise reordering"
```

---

## Decision Log

| Decision | Alternatives | Reason |
|----------|-------------|--------|
| Single `DndContext` at ProgramTemplateBuilder level | DndContext per pane | One context allows cross-pane drag (exercise from navigator to editor). Also simpler state — one `handleDragEnd`. |
| `orderedSessions` derived value + `rawSessionIndex` helper | Reorder raw sessions array in day mode | Keeps raw `sessions` as source of truth for all mutations; derived sort is purely for display and avoids index drift bugs. |
| `distance: 5` activation constraint on PointerSensor | Default (0) | Prevents accidental drags when clicking buttons (sets/reps inputs, trash, etc.) inside ExerciseCard. |
| Session DnD only in cycle mode | DnD in both modes | In day mode, order = chronological by day_of_week. Allowing drag would create confusing state where visual order ≠ day order. |
| `GripVertical` handle on exercises (always) | Entire card draggable | Cards have many interactive elements. Restricting drag to the handle prevents conflicts with inputs, buttons, selects. |
| Arrows allow inter-session movement for exercises | Intra-session only | User explicitly requested it — last exercise of session N → arrow down = first of session N+1. |
