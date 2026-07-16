# Rendez-vous Coach–Client MVP

**Date :** 2026-07-16  
**Statut :** Proposition validée — prête à implémenter  
**Scope :** Organisation des appels one-to-one entre un coach et un client actif dans STRYV lab / STRYVR.

## Résumé produit

Le rendez-vous devient un objet de suivi à part entière : le coach le planifie depuis son espace de travail, le client le retrouve dans STRYVR, reçoit les informations utiles et peut confirmer ou demander un report. Après l'appel, le coach conserve son compte-rendu et rattache les actions décidées à son organisation.

Le but n'est pas de construire un second calendrier généraliste. Il s'agit de relier chaque appel au contexte réel d'un client : préparation, historique, accès à la visioconférence et décisions de suivi.

## Décisions produit

1. **Un rendez-vous est la source de vérité.**
   - Créer une table `coaching_appointments` dédiée.
   - Ne pas copier un appel dans `agenda_events` ni dans `smart_agenda_events`.
   - Les calendriers, le dashboard et la timeline client lisent et affichent le rendez-vous comme une projection.

2. **Le coach garde la maîtrise du créneau.**
   - Le MVP permet au client de confirmer ou de demander un report, mais pas de choisir seul un nouveau créneau.
   - La prise de rendez-vous autonome, les disponibilités et la synchronisation externe sont des évolutions ultérieures.

3. **La confirmation est explicite lorsque le coach la demande.**
   - Sans demande de confirmation, le rendez-vous est directement planifié.
   - Avec demande de confirmation, le client peut confirmer ou demander un report depuis STRYVR.

4. **Les rappels sont fiables et non dupliqués.**
   - Ils s'appuient sur l'heure absolue du rendez-vous (`timestamptz`), pas sur une date/heure sans fuseau.
   - Chaque envoi est tracé afin qu'un cron ne puisse pas produire deux rappels identiques.

5. **Le lien d'appel est fourni par le coach.**
   - Le MVP accepte un lien HTTPS Zoom, Google Meet, Teams ou autre plateforme.
   - Il ne crée ni ne gère de réunion Zoom/Google Meet automatiquement.

## Parcours MVP

### 1. Création par le coach

Entrées disponibles :

- Bouton `Planifier un rendez-vous` dans l'agenda du dashboard.
- Action rapide depuis la fiche d'un client.
- Action secondaire depuis la liste des rendez-vous à venir.

Le formulaire contient :

- Client concerné ; obligatoire.
- Objet ; prérempli avec `Point de suivi`.
- Date, heure de début et durée.
- Fuseau affiché au coach et fuseau du client rappelé dans le récapitulatif.
- Modalité : visioconférence, téléphone, présentiel ou autre.
- Lien de participation facultatif, validé comme URL HTTPS.
- Message visible par le client : objectif, préparation ou consigne utile.
- Option `Demander une confirmation au client`.
- Option `Créer une tâche de préparation` dans le Kanban ; activée par défaut.

À la création :

- Le rendez-vous apparaît immédiatement dans l'agenda coach et dans le prochain point du client.
- Une tâche liée `Préparer : [objet] — [client]` est créée si l'option est activée.
- Le client reçoit une notification in-app et push si les notifications sont autorisées.
- Un e-mail transactionnel de confirmation est envoyé lorsque l'adresse e-mail est disponible.

### 2. Expérience client STRYVR

Nouvelle route : `/client/rendez-vous`.

La page affiche, dans cet ordre :

1. Le prochain rendez-vous : date et heure locale, coach, objet, état et bouton `Rejoindre l'appel` quand un lien existe.
2. Les actions de confirmation : `Confirmer` ou `Demander un report` uniquement si le rendez-vous l'exige.
3. Les prochains rendez-vous, puis l'historique récent.
4. Le message de préparation du coach, si renseigné.

Sur le dashboard client :

- Afficher une carte compacte du prochain rendez-vous quand il existe dans les 14 jours.
- Ajouter le rendez-vous à la Smart Agenda du jour, avec un lien vers `/client/rendez-vous/[appointmentId]`.
- Ne pas ajouter une cinquième entrée permanente dans la navigation basse : la carte, les notifications et la page dédiée suffisent pour le MVP.

### 3. Confirmation et report

- `Confirmer` passe un rendez-vous de `awaiting_confirmation` à `confirmed` et enregistre la date de réponse.
- `Demander un report` ouvre un champ court et passe l'état à `reschedule_requested`.
- Le coach reçoit une notification dans son inbox et retrouve le motif dans la fiche du rendez-vous.
- Le coach modifie le créneau, ou annule le rendez-vous. Une modification remet l'état à `awaiting_confirmation` si une confirmation est requise.
- Le client ne peut jamais modifier la date, le lien d'appel ni les notes du coach directement en base.

### 4. Après l'appel

Depuis la fiche du rendez-vous, le coach peut :

- Marquer l'appel comme réalisé ou absent (`no_show`).
- Ajouter un compte-rendu privé.
- Créer ou rattacher des tâches de suivi dans le Kanban.
- Planifier le prochain point depuis le même client.

Le compte-rendu reste privé au coach dans le MVP. Le partage d'un récapitulatif client est une évolution distincte, à connecter au système de messages plutôt qu'à une ouverture des notes internes.

## États du rendez-vous

| État | Sens | Action disponible au client |
| --- | --- | --- |
| `scheduled` | Créneau planifié, confirmation non requise | Consulter, rejoindre l'appel |
| `awaiting_confirmation` | Le coach attend une réponse | Confirmer ou demander un report |
| `confirmed` | Le client a confirmé | Consulter, rejoindre l'appel |
| `reschedule_requested` | Le client a demandé un report | Attendre la réponse du coach |
| `cancelled` | Rendez-vous annulé par le coach | Consulter la raison si fournie |
| `completed` | Appel réalisé | Consulter l'historique |
| `no_show` | Client absent | Consulter l'historique |

Transitions interdites :

- Un client ne peut pas annuler définitivement ni déplacer un créneau.
- Un rendez-vous passé ne peut pas revenir à `scheduled` sans que le coach ne le reprogramme explicitement.
- Un rendez-vous annulé ne déclenche plus aucun rappel.

## Modèle de données

### Table principale : `coaching_appointments`

| Champ | Type | Usage |
| --- | --- | --- |
| `id` | UUID | Identifiant du rendez-vous |
| `coach_id` | UUID | Propriétaire coach |
| `client_id` | UUID | Client suivi (`coach_clients.id`) |
| `title` | TEXT | Objet court de l'appel |
| `starts_at` | TIMESTAMPTZ | Début, source de vérité temporelle |
| `ends_at` | TIMESTAMPTZ | Fin ; doit être postérieure au début |
| `client_timezone` | TEXT | Fuseau du client au moment de la planification |
| `meeting_kind` | TEXT | `video`, `phone`, `in_person`, `other` |
| `meeting_url` | TEXT nullable | Lien HTTPS facultatif |
| `client_message` | TEXT nullable | Objectif ou préparation visible par le client |
| `coach_private_notes` | TEXT nullable | Compte-rendu interne uniquement |
| `confirmation_required` | BOOLEAN | Contrôle la confirmation client |
| `status` | TEXT | État métier ci-dessus |
| `reschedule_reason` | TEXT nullable | Motif court transmis par le client |
| `responded_at` | TIMESTAMPTZ nullable | Dernière réponse client |
| `cancelled_at` / `cancel_reason` | TIMESTAMPTZ / TEXT | Annulation coach |
| `completed_at` | TIMESTAMPTZ nullable | Clôture coach |
| `created_at` / `updated_at` | TIMESTAMPTZ | Audit technique |

Contraintes principales :

- `ends_at > starts_at`.
- `status` limité aux sept états documentés.
- `meeting_kind` limité aux quatre modalités documentées.
- L'appartenance du client au coach est validée dans les API métier ; le client doit être actif au moment de la création.
- Index : `(coach_id, starts_at)`, `(client_id, starts_at)`, `(status, starts_at)`.

### Journal d'activité : `coaching_appointment_activity`

Chaque action importante écrit une ligne : création, changement de créneau, confirmation, demande de report, annulation, clôture et absence.

Champs : `appointment_id`, `actor_role`, `actor_user_id`, `event_type`, `metadata`, `created_at`.

Le journal permet d'afficher l'historique sans surcharger la table principale et facilite le support produit.

### Suivi de livraison : `coaching_appointment_notification_deliveries`

Cette table évite les doublons entre création, modification et tâches planifiées.

Champs : `appointment_id`, `channel` (`in_app`, `push`, `email`), `kind` (`created`, `updated`, `cancelled`, `reminder_24h`, `reminder_1h`, `reschedule_requested`), `scheduled_for`, `sent_at`, `status`, `provider_message_id`, `error`, `created_at`.

Contrainte unique : `(appointment_id, channel, kind, scheduled_for)`.

### Lien avec le Kanban

Ajouter `appointment_id UUID NULL REFERENCES coaching_appointments(id) ON DELETE SET NULL` à `kanban_tasks`.

Cette liaison représente uniquement une tâche de préparation ou de suivi. Le statut d'une tâche ne modifie jamais automatiquement le statut d'un rendez-vous.

## Autorisations et sécurité

### Coach

- Peut créer, voir, modifier et annuler uniquement les rendez-vous dont `coach_id = auth.uid()`.
- Peut lire et modifier les notes privées.
- Peut rattacher une tâche uniquement à ses propres boards et colonnes.

### Client

- Peut lire uniquement ses propres rendez-vous via son lien `coach_clients.user_id = auth.uid()`.
- Peut confirmer ou demander un report exclusivement par une route serveur dédiée.
- Ne reçoit jamais `coach_private_notes`, ni les données de livraison, ni les informations d'un autre client.

### API et validation

- Les routes coach vérifient que `client_id` appartient bien au coach connecté avant chaque écriture.
- Les routes client vérifient le rendez-vous et le client à partir de l'utilisateur authentifié ; elles n'acceptent jamais un `client_id` venant du navigateur.
- Le lien d'appel est contrôlé avec `new URL`, `https:` uniquement et une longueur maximale raisonnable.
- Les notes et motifs sont nettoyés, bornés en taille et rendus comme texte, jamais comme HTML.
- Les politiques RLS permettent la lecture client, mais aucune mise à jour directe de l'état métier par le client. La mutation passe par l'API authentifiée.

## Notifications et e-mails

### Matrice d'envoi MVP

| Déclencheur | In-app | Push | E-mail |
| --- | --- | --- | --- |
| Rendez-vous créé | Oui | Oui si autorisé | Oui |
| Créneau ou lien modifié | Oui | Oui si autorisé | Oui |
| Annulation | Oui | Oui si autorisé | Oui |
| Confirmation demandée | Oui | Oui si autorisé | Oui |
| Demande de report | Inbox coach | Optionnel | Non |
| Rappel 24 h avant | Oui | Oui si autorisé | Oui |
| Rappel 1 h avant | Oui | Oui si autorisé | Non |

Règles :

- Les e-mails de création, modification et annulation sont transactionnels ; ils ne sont pas traités comme une campagne marketing.
- Les push respectent une nouvelle préférence client `notif_appointment_reminders`, activée par défaut, sans empêcher les informations critiques in-app.
- Les rappels sont annulés si le rendez-vous est annulé, terminé ou déplacé.
- Lors d'un déplacement, les anciennes livraisons programmées sont marquées `cancelled`, puis les nouvelles sont calculées.
- Aucun rappel n'est créé s'il serait déjà dans le passé ; un rendez-vous créé à moins d'une heure du début reçoit uniquement l'information de création.

### Réutilisation de l'existant

- Étendre `coach_client_notifications` avec le type `appointment`.
- Étendre `lib/notifications/create-client-app-notification.ts` et `lib/notifications/send-client-push.ts` avec le type et la préférence rendez-vous.
- Ajouter les textes localisés dans `lib/notifications/client-push-copy.ts` et `lib/i18n/clientTranslations.ts`.
- Ajouter les modèles e-mail dans `lib/email/mailer.ts`.
- Créer une fonction Inngest toutes les cinq minutes sur le modèle de `client-engagement-reminders.ts`, avec un verrou de livraison en base.

## Surfaces à faire évoluer

### Espace coach

- `components/dashboard/OrgSummary.tsx` : afficher les prochains appels comme une catégorie distincte, sans les confondre avec les rappels génériques.
- `components/ui/AgendaCalendar.tsx` : fusionner visuellement les événements internes et les rendez-vous dans la grille, avec un repère de type `Appel client`.
- Dashboard : ajouter une action rapide `Planifier un rendez-vous` et une vue filtrée `Rendez-vous` dans l'agenda.
- Fiche client : bloc `Rendez-vous` avec prochain créneau, historique et action de création.
- Kanban : proposer la création de tâche de préparation ou de suivi depuis la fiche du rendez-vous.

### Espace client

- `/client/rendez-vous/page.tsx` : liste et détail du prochain rendez-vous.
- `/client/rendez-vous/[appointmentId]/page.tsx` : détail, confirmation, report et accès au lien.
- `components/client/ClientDashboard.tsx` : carte du prochain appel sur le dashboard quand il est proche.
- `lib/client/smart/timelineBuilder.ts` : ajouter le type `appointment` afin de rendre l'appel dans la Smart Agenda, sans écrire dans `smart_agenda_events`.
- `components/client/smart/SmartAgendaTimeline.tsx` : icône et style spécifique, accessible sans s'appuyer seulement sur la couleur.

## API proposée

### Coach

- `GET /api/coach/appointments?from=&to=&clientId=&status=` : liste filtrée.
- `POST /api/coach/appointments` : crée le rendez-vous, la tâche optionnelle et les notifications de création.
- `PATCH /api/coach/appointments/[appointmentId]` : modifie, annule, clôture ou marque absent ; recalcule les notifications si nécessaire.
- `POST /api/coach/appointments/[appointmentId]/tasks` : crée une tâche de préparation ou de suivi liée.

### Client

- `GET /api/client/appointments?scope=upcoming|history` : liste sécurisée du client connecté.
- `GET /api/client/appointments/[appointmentId]` : détail client sans notes privées.
- `POST /api/client/appointments/[appointmentId]/respond` : `{ action: 'confirm' | 'request_reschedule', reason?: string }`.

Les schémas Zod sont requis sur toutes les écritures. Les réponses utilisent une vue client dédiée afin d'éviter toute fuite de colonne interne.

## Migration SQL : squelette

Créer `/Users/user/Desktop/STRYVLAB/supabase/migrations/20260716_coaching_appointments.sql`.

```sql
CREATE TABLE public.coaching_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  client_timezone text NOT NULL DEFAULT 'Europe/Paris',
  meeting_kind text NOT NULL DEFAULT 'video'
    CHECK (meeting_kind IN ('video', 'phone', 'in_person', 'other')),
  meeting_url text,
  client_message text,
  coach_private_notes text,
  confirmation_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'awaiting_confirmation', 'confirmed', 'reschedule_requested', 'cancelled', 'completed', 'no_show')),
  reschedule_reason text,
  responded_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX coaching_appointments_coach_starts_idx
  ON public.coaching_appointments (coach_id, starts_at);
CREATE INDEX coaching_appointments_client_starts_idx
  ON public.coaching_appointments (client_id, starts_at);

ALTER TABLE public.coaching_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach manages own coaching appointments"
  ON public.coaching_appointments FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client reads own coaching appointments"
  ON public.coaching_appointments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = coaching_appointments.client_id
      AND cc.user_id = auth.uid()
  ));

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS appointment_id uuid
  REFERENCES public.coaching_appointments(id) ON DELETE SET NULL;
```

La migration finale doit aussi créer les deux tables de journalisation, l'index de déduplication de livraison et mettre à jour la contrainte de type de `coach_client_notifications` sans supprimer les types déjà existants.

## Hors périmètre MVP

- Disponibilités et réservation autonome par le client.
- Synchronisation Google Calendar, Outlook ou Cal.com.
- Création automatique de liens Zoom, Meet ou Teams.
- Rendez-vous récurrents.
- Gestion d'équipe et attribution d'un rendez-vous à plusieurs coachs.
- Partage automatique des notes privées au client.
- Paiement, facturation ou annulation avec conditions commerciales.
- SMS ou WhatsApp.

## Ordre d'implémentation

### Slice 1 — Domaine sécurisé

1. Migration, contraintes, index et RLS.
2. Types TypeScript et helpers de sérialisation client/coach.
3. APIs coach de création, lecture et modification avec validation Zod.
4. Tests API : appartenance client/coach, refus cross-tenant, validation date/lien et transitions d'état.

### Slice 2 — Planification coach

1. Formulaire de rendez-vous depuis le dashboard et la fiche client.
2. Liste des prochains appels dans `OrgSummary`.
3. Fusion de lecture dans `AgendaCalendar` ; aucune duplication dans `agenda_events`.
4. Création optionnelle de tâche Kanban liée.

### Slice 3 — Expérience client

1. Page `/client/rendez-vous` et détail client.
2. Carte du prochain appel dans le dashboard client.
3. Confirmation et demande de report via route serveur.
4. Notification coach pour toute demande de report.

### Slice 4 — Livraison et rappels

1. Type de notification, préférence push et contenus localisés.
2. E-mails transactionnels création/modification/annulation.
3. Fonction Inngest de programmation et de rappel, protégée contre les doublons.
4. Vérification sur un client sans push, sans e-mail et avec préférences désactivées.

### Slice 5 — Clôture et qualité

1. Compte-rendu privé, états `completed` et `no_show`.
2. Tâches de suivi liées.
3. Tests des fuseaux horaires, des annulations et des rendez-vous reprogrammés.
4. Vérification responsive à 390 px, 768 px et 1440 px, ainsi que navigation clavier et textes de statut.

## Critères d'acceptation MVP

- Un coach peut créer un appel lié à un seul client actif depuis le dashboard.
- Le client voit le même créneau dans son fuseau horaire et peut rejoindre l'appel si un lien est fourni.
- La confirmation et la demande de report mettent à jour le coach sans fuite de notes internes.
- Un créneau déplacé ou annulé ne produit aucun rappel obsolète.
- Chaque notification de rendez-vous est traçable, sans doublon de cron.
- Les événements génériques existants, l'agenda client existant et le Kanban continuent de fonctionner sans changement de comportement.
- Les données de rendez-vous restent isolées par coach et par client via API et RLS.

## Hypothèses à valider avant mise en production

- Le rendez-vous coach–client est disponible pour les offres avec STRYVR actif (`Pro` et `Studio`) ; le coach peut conserver son agenda interne hors de ce périmètre.
- Le consentement e-mail transactionnel suit les règles déjà appliquées aux e-mails de suivi client.
- Les e-mails sont envoyés dans la langue résolue pour le client, comme les notifications push.
- La première version ne réserve pas de créneau automatiquement : un lien Cal.com ou une synchronisation externe reste un complément futur.
