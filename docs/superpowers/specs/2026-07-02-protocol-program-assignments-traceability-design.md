# Protocol / Program Assignments — Traceability Design

**Date:** 2026-07-02  
**Status:** Approved for implementation

---

## Goal

Garantir une traçabilité historique fiable des périodes d'activation réelles :

- des protocoles nutritionnels
- des programmes workout

afin que :

- les cartes Studio reflètent une vraie période d'exposition
- `Metrics` puisse retracer les changements
- les comparaisons avant/après restent défendables

---

## Problem

L'état actuel mélange deux choses :

- la timeline produit lisible (`metric_annotations`)
- la vérité analytique

Aujourd'hui :

- `Nutrition Studio` compare les logs récents du client à chaque protocole
- `Workout Studio` est mieux rattaché au programme, mais repose encore partiellement sur des inférences

Conséquence :

- impossible de garantir proprement qu'une adhérence appartient à un protocole ou programme précis sur une période donnée

---

## Decision Log

### Decision 1 — Separate timeline from analytical truth

- **Décidé :** conserver `metric_annotations` comme timeline produit, mais introduire des tables d'assignments comme source de vérité analytique.
- **Pourquoi :** les événements lisibles et les périodes d'exposition ne servent pas le même usage.

### Decision 2 — One active assignment per domain

- **Décidé :** un seul assignment actif à la fois :
  - un en nutrition
  - un en workout
- **Pourquoi :** éviter l'ambiguïté analytique sur la période active.

### Decision 3 — Phase 1 window-based attribution

- **Décidé :** dans un premier temps, l'attribution analytique se fait par fenêtre `started_at → ended_at`.
- **Pourquoi :** c'est la manière la plus pragmatique de résoudre le problème produit sans exiger un refactoring complet de tous les events métier.

### Decision 4 — Phase 2 event-level attribution

- **Décidé :** dans un second temps, stocker directement l'ID actif sur les événements métier fins.
- **Pourquoi :** renforcer la robustesse pour les analyses avancées, l'IA, les audits et les comparaisons précises.

---

## Schema

## New table — `client_nutrition_protocol_assignments`

Represents a real activation window for a nutrition protocol.

Columns:

- `id uuid primary key`
- `client_id uuid not null`
- `coach_id uuid not null`
- `protocol_id uuid not null`
- `started_at timestamptz not null default now()`
- `ended_at timestamptz null`
- `started_reason text not null`
- `ended_reason text null`
- `started_by uuid not null`
- `ended_by uuid null`
- `source_annotation_id uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- `ended_at is null` = assignment actif
- partial unique index on `(client_id)` where `ended_at is null`

Allowed reasons:

- `share`
- `manual_switch`
- `replace`
- `unshare`
- `delete`

## New table — `client_workout_program_assignments`

Represents a real activation window for a workout program.

Columns:

- `id uuid primary key`
- `client_id uuid not null`
- `coach_id uuid not null`
- `program_id uuid not null`
- `started_at timestamptz not null default now()`
- `ended_at timestamptz null`
- `started_reason text not null`
- `ended_reason text null`
- `started_by uuid not null`
- `ended_by uuid null`
- `source_annotation_id uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- `ended_at is null` = assignment actif
- partial unique index on `(client_id)` where `ended_at is null`

Allowed reasons:

- `publish`
- `manual_switch`
- `replace`
- `unpublish`
- `delete`

---

## Writing rules

## Nutrition

### Share protocol

When a protocol is shared:

1. close any active nutrition assignment for the client
2. open a new assignment for the shared protocol
3. keep `metric_annotations` event creation

### Unshare protocol

When a protocol is unshared:

1. close the active assignment for this protocol if present
2. keep timeline cleanup behavior as currently implemented if desired

### Delete protocol

When a protocol is deleted:

1. close the active assignment for this protocol if present
2. then delete the protocol

## Workout

### Publish / activate program

When a program becomes client-visible (`is_client_visible = true`):

1. close any active workout assignment for the client
2. open a new assignment for this program

### Unpublish / deactivate program

When a program leaves client-visible state (`is_client_visible = false`):

1. close the active assignment for this program if present

### Delete program

When a program is deleted:

1. close the active assignment for this program if present
2. then delete the program

---

## Scope of implementation — Phase 1 + Phase 2 (write model only)

This implementation batch includes:

- migrations for both assignment tables
- helper functions for opening and closing assignments
- nutrition share / unshare / delete wired to assignments
- workout publish / unpublish / delete wired to assignments

This batch does **not** yet include:

- rebasing Studio card analytics on assignments
- rebasing `Metrics` reads on assignments
- historical reconstruction
- event-level attribution on all fine-grained events

---

## Source of truth after implementation

- **Timeline product:** `metric_annotations`
- **Analytical truth:** assignment tables

`Metrics` and Studio analytics should later read assignments first, not annotations.

---

## Risks

- existing historical analytics remain partially ambiguous until read-side migration is completed
- legacy workflows may still create product events without corresponding analytical reads
- deleting annotations must never be treated as deleting analytical history

---

## Next steps after this batch

1. migrate Nutrition Studio reads to assignment windows
2. migrate Workout Studio reads to assignment windows
3. migrate `Metrics` to assignment windows
4. add event-level attribution fields where needed
5. backfill historical inferred assignments if desired
