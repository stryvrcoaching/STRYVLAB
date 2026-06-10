# Chat ⇄ Check-in ⇄ Bot IA — Cohérence & Qualité (Design)

> Statut : **DESIGN — en validation** · Date : 2026-06-01 · Branche : `feat/chat-first-sp1`
> Skill : brainstorming. Aucune implémentation avant validation finale du Decision Log.

---

## 1. Understanding Summary

- **Quoi** : refondre le système coach IA côté client (chat + check-in) pour qu'il soit **factuellement honnête**, **utile** (conseils non génériques), **cohérent** entre les deux chemins (check-in ⇄ chat), et **piloté par la config coach** (ton, routines, champs).
- **Pourquoi** : aujourd'hui le bot (1) ne salue pas le matin / affiche le check-in « déjà validé », (2) félicite à tort (« bien avancé, 9000 pas, alimentation presque complète » alors que séance annulée + dépassement calorique), (3) donne des conseils vides (« écoute ton corps pour les courbatures »), (4) envoie un rappel du soir plat et non priorisé.
- **Pour qui** : clients de la PWA (`/client`), config par le coach (`/coach`).
- **Contraintes** : Next.js App Router, Prisma/Supabase, Inngest (crons routine), gpt-4o-mini (OpenAI) actuel, DS v3.0 (client) + DS v2.0 (coach). `schema-first` (feature-delivery). TS strict 0 erreur. CHANGELOG + project-state à jour.
- **Non-goals (cette itération)** : changer de provider LLM ; refondre le moteur d'entraînement ; gamification/points.

## 2. Décisions de cadrage (validées avec l'utilisateur)

| # | Décision | Choix | Alternatives écartées |
|---|----------|-------|----------------------|
| D1 | Alignement check-in ⇄ chat | **Source unique partagée** (module `dailyCoachState`) | Patcher chaque chemin (divergence revient) |
| D2 | Génération messages | **Faits déterministes + LLM phrasing seulement** | LLM libre |
| D3 | Phrasing final | **LLM contraint + fallback templates par ton** | Templates 100% déterministes |
| D4 | Conseils | **Bibliothèque de règles curées** (validées par l'utilisateur) | LLM génère / pas de conseil auto |
| D5 | Ton | **Piloté par config coach** : per-client `ai_tone` ?? global `ai_tone` ?? `bienveillant`. Plancher : jamais de fausse louange, toujours nommer les faits | Ton fixe |
| D6 | Ordre actions réveil | **BPM → durée sommeil → qualité sommeil → énergie → poids (dernier)** | autres ordres |
| D7 | Périmètre itération | **Tout en bloc** : inclut la relocalisation de la config check-in dans le profil coach (section IA Coach) | Slice bot seule |
| D8 | Champs check-in | **Registre canonique unique** de champs (clé, label, colonne DB, flow, priorité) consommé partout | Garder 3 vocabulaires |
| D9 | Périmètre conseils | **L'IA ne touche JAMAIS la programmation du coach** (pas de « reprogramme », « baisse la charge », « décale »). Conseils = **tips lifestyle uniquement**, sans impact programme | Conseils libres |
| D10 | Sujets hors-périmètre | **Jamais de déflection vers le coach humain** (« vois ça avec ton coach » = interdit). L'IA EST le coach (extension, photo du coach). Sujet program/médical → **notification silencieuse au coach en back-end** (`coach_notifications`), invisible côté client | Rediriger vers coach |
| D11 | Liberté de coaching | **Slider « liberté IA »** dans la section IA du profil coach : aucun conseil / tips sécurisés / étendu. Gate le VOLUME/proactivité des tips. Le program-touching reste interdit à tous les niveaux | Latitude fixe |
| D12 | Tendance | **1 jour raté = note légère** dans le débrief ; **3 jours d'affilée = sérieux**, ton plus ferme (calories, macros, hydratation) | Jour isolé seulement |
| D13 | Tips sans présomption | Aucun tip ne **présume d'une habitude inconnue** (ex: caféine). Tips alignés sur la **méthode du coach** (ex: hydratation = gorgées ancrées à moments-clés/rituel, pas « fixe ta bouteille 2L ») | Tips génériques |
| D14 | `mood` | Mapper sur `stress_level` (pas de colonne dédiée) | Colonne dédiée |
| D15 | Slider liberté | **3 niveaux** `none / safe / extended`, **défaut `safe`** | 0-100 continu / on-off |
| D16 | Canal coach_alert | **Réutiliser `coach_notifications`** existant (vérifier format avant) | Nouveau canal |

## 3. Assumptions (à confirmer)

- A1 — On garde OpenAI gpt-4o-mini pour le phrasing (pas de migration AI Gateway maintenant).
- A2 — Le « day-kind » (training / repos / annulé) est déjà stocké (`client_workout_skips`, override jour). À vérifier : table `client_day_overrides` / `fetchClientDayOverride`.
- A3 — Les colonnes DB check-in existantes (`client_daily_checkins`) sont la vérité ; on aligne la config coach et les messages dessus, pas l'inverse.
- A4 — Le rappel du soir et le greeting du matin doivent démarrer par la **première action activée** du client dans l'ordre D6 (BPM en tête s'il est activé).
- A5 — Le bug « matin vide / déjà validé » sera investigué sur données réelles **après** la slice qualité bot (priorité utilisateur).

## 4. Problème racine identifié — incohérence des clés de champs

Trois vocabulaires non alignés :

| Couche | Clés matin | BPM ? | Poids ? |
|--------|-----------|-------|---------|
| Config coach UI (`check-ins/page.tsx`) | `sleep_duration`, `sleep_quality`, `energy` | ❌ absent | ❌ absent |
| `routineMessages.ts` | `rhr_morning`, `weight_kg`, `sleep_quality`, `sleep_hours`, `energy_level` | ✅ | ✅ |
| DB / formulaire (`checkinSchema`) | `sleep_hours`, `sleep_quality`, `energy_level`, `weight_kg`, `rhr_morning`, `daily_steps`, `hunger_level`, `muscle_soreness`, `stress_level` | ✅ | ✅ |

→ La config coach n'offre **ni BPM ni poids**, et ses clés ne matchent pas celles des messages → checklist & rappel incohérents. **Cause directe** des incohérences décrites.

---

## 5. Architecture cible

### 5.1 Registre canonique de champs — `lib/client/checkin/fieldRegistry.ts`

Source unique de vérité. Une entrée par champ :

```ts
type CheckinFieldDef = {
  key: 'rhr_morning' | 'sleep_hours' | 'sleep_quality' | 'energy_level'
     | 'weight_kg' | 'stress_level' | 'muscle_soreness' | 'hunger_level' | 'daily_steps'
  dbColumn: string            // colonne client_daily_checkins
  flow: 'morning' | 'evening' | 'both'
  label: string               // FR affichage
  wakingPriority: number | null // ordre réveil (D6) ; null si non-matin
  unit?: string
  scale?: { min: number; max: number; labels?: Record<number,string> }
}
```

Ordre réveil (D6) : `rhr_morning`(1) → `sleep_hours`(2) → `sleep_quality`(3) → `energy_level`(4) → `weight_kg`(5).
Consommé par : config coach UI, formulaire check-in client, `routineMessages`, module de faits, prompt système. **Suppression des constantes locales** `MORNING_FIELDS`/`EVENING_FIELDS`/`FIELD_LABELS`/`FIELD_ORDER`.

→ Migration de données : remapper les `moments[].fields` existants (`sleep_duration`→`sleep_hours`, `energy`→`energy_level`, `energy_evening`→`energy_level`, `stress`→`stress_level`, `mood`→? à clarifier) via un script idempotent.

### 5.2 Module source-unique — `lib/client/ai-coach/dailyCoachState.ts`

Calcule **une fois** l'état du jour, consommé par cron, today-strip, POST check-in :

```ts
type DailyCoachState = {
  date: string; timezone: string
  dayKind: 'training' | 'rest' | 'cancelled'
  pendingSlots: PendingSlot[]
  facts: DailyFacts            // cf. 5.3
  tone: ResolvedTone           // cf. 5.5
  enabledFields: { morning: CheckinFieldDef[]; evening: CheckinFieldDef[] }
}
```

Élimine les 3 calculs parallèles divergents (`shouldProactiveInitNow`, `countPendingSlots`, POST).

### 5.3 Couche de faits déterministes — `DailyFacts`

Aucune interprétation, que des faits mesurés :

```ts
type DailyFacts = {
  session: { planned: string|null; status: 'completed'|'skipped'|'cancelled'|'rest'|'none' }
  nutrition: { kcalLogged:number; kcalTarget:number; deltaKcal:number; pctKcal:number;
               proteinLogged:number; proteinTarget:number; status:'under'|'on_track'|'over' }
  hydration: { ml:number; targetMl:number; pct:number }
  steps: number|null
  checkin: { sleepHours?:number; sleepQuality?:number; energy?:number;
             stress?:number; soreness?:number; rhr?:number; weight?:number }
  trends?: { kcal3d:number[]; weightDelta?:number }
}
```

`status:'over'` quand `deltaKcal > +seuil` ; le module **connaît** le day-kind (repos après annulation) → cible repos correcte → plus de « presque complète » faux.

### 5.4 Bibliothèque de tips curés — `lib/client/ai-coach/adviceRules.ts`

Règles `{ id, when(facts,state):boolean, priority, scope:'tip'|'coach_alert', freedomMin:'none'|'safe'|'extended', text(tone):string }`.

**Frontière dure (D9/D10) :**
- `scope:'tip'` → tip lifestyle **sans impact programme**, affiché au client (gated par le niveau de liberté `freedomMin ≤ niveau coach`).
- `scope:'coach_alert'` → signal lié au **programme / médical / risque** : **jamais affiché au client**, déclenche une `coach_notifications` silencieuse. L'IA reste en personnage (n'évoque pas le coach).
- **Interdits absolus** : conseil qui modifie la prog (charge, repos, décalage séance), déflection vers le coach humain, présomption d'habitude inconnue (D13), générique (« écoute ton corps », « gère ton stress »).

Sélection déterministe (top 1-2 tips par priorité selon liberté), LLM reformule selon le ton. Draft en §7 (à retravailler ensemble).

### 5.5 Résolution du ton — `lib/client/ai-coach/resolveTone.ts`

`effectiveTone = perClient.ai_tone ?? coachProfile.ai_tone ?? 'bienveillant'`.
4 tons : `strict | bienveillant | motivant | neutre`. Matrice de phrasing par ton (lexique, longueur, ouverture/clôture). **Câblage manquant aujourd'hui** : `buildSystemPrompt` code en dur « bienveillant et direct » → à remplacer.
**Supprimer** la règle de [buildSystemPrompt.ts L361] (« Je préfère que tu vois ça directement avec [coach] ») — viole D10. Remplacer par : rester en personnage + déclencher `coach_alert` si besoin.

### 5.6 Builders de messages

- **Greeting matin** (`morning_init`) : salutation + contexte jour + CTA check-in + 1ʳᵉ action activée (ordre D6).
- **Clôture post-check-in** (`text`) : **faits numérotés en langage naturel** (débrief court) → adapté au ton → 1-2 actions concrètes (demain / jours suivants). LLM contraint sur `DailyFacts` + advice ; rejet si invente une donnée ; fallback template par ton.
- **Rappel du soir** (`buildMorningPreparationReminder`) : phrase naturelle qui prépare mentalement, démarre par la 1ʳᵉ action activée (BPM si activé). Plus de liste à virgules.

### 5.7 Refonte config coach (D7)

- Étendre la config check-in pour offrir **tous** les champs canoniques (dont BPM, poids) par moment. (DB le supporte déjà — colonnes `rhr_morning`, `weight_kg` existent et sont déjà remplies par le formulaire client ; seule la config coach ne les expose pas.)
- **Relocaliser** la config check-in (`/coach/clients/[id]/check-ins`) dans la section **IA Coach** du profil (`profil/page.tsx`, à côté de `AiCoachSettingsWidget`).
- **Nouveau réglage** : slider « Liberté de coaching IA » (`none` / `safe` / `extended`) dans `coach_ai_settings_per_client` (nouvelle colonne) → gate les tips (D11). Défaut : `safe`.
- API `checkin-config` + `ai-settings` consomment le registre canonique.

---

## 6. Ordre d'implémentation (schema-first)

1. **Registre canonique** `fieldRegistry.ts` (+ migration remap `moments[].fields`).
2. **`DailyFacts` + `dailyCoachState`** (module source unique) + tests.
3. **`resolveTone` + matrice ton** + câblage `buildSystemPrompt`.
4. **`adviceRules`** (après validation §7) + tests.
5. **Builders** : clôture, greeting matin, rappel soir (réécriture `routineMessages` + bloc clôture `checkin/route.ts`) + tests.
6. **Config coach** : champs étendus + relocalisation profil.
7. **Bug matin** (investigation live : cron / settings / UI strip).
8. Docs : CHANGELOG + project-state + data-model.

---

## 7. DRAFT bibliothèque de tips — À RETRAVAILLER ENSEMBLE (v2)

> Révisé selon D9/D10/D13. Tous `scope:'tip'` sauf indication. Aucun ne touche la prog ni ne défléchit vers le coach. Phrasé neutre ; ton appliqué au rendu.

**Nutrition — jour isolé (note légère, D12)**
- N1 dépassement +100..+300 kcal : mention factuelle dans le débrief, pas d'alarme. « Léger dépassement aujourd'hui, rien de grave. »
- N2 protéines < 80% cible : « Protéines un peu courtes ({x}g/{cible}g) — facile à rattraper au prochain repas. » *(tip, pas de prescription prog)*

**Nutrition — tendance 3 jours (sérieux, D12)**
- N3 dépassement kcal 3 jours d'affilée : ton ferme selon réglage. « 3 jours au-dessus de la cible : là il faut resserrer. » → **aussi** `coach_alert` silencieux.
- N4 protéines < cible 3 jours : « Protéines sous la cible depuis 3 jours, à corriger. » → `coach_alert`.

**Séance**
- S1 status `cancelled`/`skipped` jour training : **fait nommé seulement**, zéro fausse louange, **aucune reprogrammation** (interdit). → `coach_alert` silencieux (le coach gère la reprog). Côté client : « Séance non faite aujourd'hui. » (+ ton).
- S2 status `completed` : « Séance bouclée. » (pas de conseil-excuse).
- ~~S3 soreness → baisse charge~~ **SUPPRIMÉ** (program-touching, D9). Courbatures fortes → `coach_alert` silencieux, pas de prescription au client.

**Récup / signaux — tips lifestyle only**
- R1 sleepHours < 6 : tip d'hygiène **sans présomption** (D13). « Nuit courte ({x}h) — pense à t'hydrater dès le réveil. » *(pas de caféine sauf si habitude connue)*
- ~~R2 rhr élevé → allège l'intensité~~ **SUPPRIMÉ** (program-touching). rhr anormal → `coach_alert` silencieux.
- R3 stress ≥ 4 : « Stress élevé noté. 5 min de respiration ou une courte marche avant le coucher aident concrètement. » *(tip pur, OK)*

**Hydratation — aligné méthode coach (D13)**
- H1 pct < 60% : « Hydratation à {pct}%. Le plus simple : ancre des gorgées à des moments-clés de ta journée (réveil, chaque repas, séance) plutôt que viser une grosse bouteille d'un coup. »

**À trancher ensemble :** seuils exacts, formulation méthode hydratation, quels signaux déclenchent un `coach_alert` (et lesquels existent déjà côté plateforme coach), wording par niveau de liberté.

---

## 8. Risques & vigilance

- Migration `moments[].fields` : remap `mood` ambigu (pas de colonne DB ?) → clarifier ou drop.
- LLM peut encore dériver → validation stricte des faits + fallback obligatoire.
- Relocalisation config check-in : ne pas casser les liens/nav existants (`/check-ins`).
- Le bug matin peut être un cron Inngest non déclenché en preview/local — vérifier dashboard.

## 9. Open questions

- OQ1 — ~~`mood`~~ → résolu : map sur `stress_level` (D14).
- OQ2 — Greeting/rappel : longueur max cible (nb phrases) par ton ?
- OQ3 — `coach_alert` : quels événements la plateforme coach gère-t-elle déjà (`coach_notifications`) ? Aligner pour ne pas dupliquer.

## 10. Investigation bug matin — données réelles (projet `gdwboxpscwdvfrnxlnvb`, client `2e33b381…`, tz Europe/Brussels)

**Constats DB (01-06) :**
- ✅ IA tout activée : `ai_llm_enabled`, `has_ai_llm`, routines matin+soir = true ; ton `strict` (per-client + global).
- ❌ **Aucun `morning_init` pour le 01-06** ; aucun `client_daily_checkins` pour le 01-06.
- Le `morning_init` du 31-05 a été inséré à **14:30 Bruxelles** (hors fenêtre cron 06–07) → preuve que l'init vient du **GET on-demand** (`ensureAutomatedChatMessages`, [messages/route.ts:239]), pas du cron planifié.
- Check-in 31-05 matin contient `rhr_morning=55`, `weight_kg=79.6` → **le formulaire client collecte BPM/poids** alors que la config coach (`moments.morning.fields = [sleep_duration, sleep_quality, energy]`) ne les expose pas → incohérence form ↔ config ↔ messages (clés `sleep_duration` vs `sleep_hours`).

**Analyse logique :** au GET de 11:40, `shouldProactiveInitNow(morning)` = true et pas d'`existing` → l'insert *aurait dû* se produire. Aucune ligne n'existe ⇒ **le GET n'a pas tourné côté serveur ce matin**.

**Cause racine (forte) :**
1. Le `morning_init` est **créé paresseusement au GET `/messages`** — pas de push proactif fiable. Le cron `chat-morning-brief` existe mais sa fenêtre/déclenchement ne pré-crée pas le message (Inngest cron non fiable ici, à vérifier dashboard).
2. **PWA sans refetch au resume/focus** : SW = `networkOnly` sur `/api/` (ne cache pas), mais le client ([ChatPage.tsx] fetch sur mount uniquement) ne re-fetch pas à la reprise de l'app → affiche l'état de la nuit (messages sans init + today-strip « tout fait » car les 2 check-ins du 31-05 étaient complétés). Explique **les deux symptômes**.

**Fix (étape 7, à valider) :**
- Rendre le **cron proactif** la source du `morning_init` + badge non-lu + push (pré-créé avant ouverture), GET = simple fallback idempotent.
- **Refetch au `visibilitychange`/focus** dans ChatPage + today-strip.
- Brancher cron, GET, today-strip sur le module **`dailyCoachState`** (source unique) → fin de la divergence.
