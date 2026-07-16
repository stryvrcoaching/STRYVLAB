-- ─────────────────────────────────────────────────────────────────────────────
-- coaching_appointments MVP
-- 2026-07-16
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table principale ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coaching_appointments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id            uuid        NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  title                text        NOT NULL,
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz NOT NULL,
  client_timezone      text        NOT NULL DEFAULT 'Europe/Paris',
  meeting_kind         text        NOT NULL DEFAULT 'video'
                         CHECK (meeting_kind IN ('video', 'phone', 'in_person', 'other')),
  meeting_url          text,
  client_message       text,
  coach_private_notes  text,
  confirmation_required boolean   NOT NULL DEFAULT false,
  status               text        NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN (
                           'scheduled',
                           'awaiting_confirmation',
                           'confirmed',
                           'reschedule_requested',
                           'cancelled',
                           'completed',
                           'no_show'
                         )),
  reschedule_reason    text,
  responded_at         timestamptz,
  cancelled_at         timestamptz,
  cancel_reason        text,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS coaching_appointments_coach_starts_idx
  ON public.coaching_appointments (coach_id, starts_at);
CREATE INDEX IF NOT EXISTS coaching_appointments_client_starts_idx
  ON public.coaching_appointments (client_id, starts_at);
CREATE INDEX IF NOT EXISTS coaching_appointments_status_starts_idx
  ON public.coaching_appointments (status, starts_at);

ALTER TABLE public.coaching_appointments ENABLE ROW LEVEL SECURITY;

-- Coach : accès complet à ses propres rendez-vous
CREATE POLICY "coach manages own coaching appointments"
  ON public.coaching_appointments FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Client : lecture uniquement via coach_clients.user_id
CREATE POLICY "client reads own coaching appointments"
  ON public.coaching_appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_clients cc
      WHERE cc.id = coaching_appointments.client_id
        AND cc.user_id = auth.uid()
    )
  );

-- ── 2. Journal d'activité ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coaching_appointment_activity (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid        NOT NULL REFERENCES public.coaching_appointments(id) ON DELETE CASCADE,
  actor_role     text        NOT NULL CHECK (actor_role IN ('coach', 'client', 'system')),
  actor_user_id  uuid,
  event_type     text        NOT NULL,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coaching_appointment_activity_appointment_idx
  ON public.coaching_appointment_activity (appointment_id, created_at);

ALTER TABLE public.coaching_appointment_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach reads own appointment activity"
  ON public.coaching_appointment_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coaching_appointments ca
      WHERE ca.id = coaching_appointment_activity.appointment_id
        AND ca.coach_id = auth.uid()
    )
  );

-- ── 3. Suivi de livraison des notifications ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coaching_appointment_notification_deliveries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      uuid        NOT NULL REFERENCES public.coaching_appointments(id) ON DELETE CASCADE,
  channel             text        NOT NULL CHECK (channel IN ('in_app', 'push', 'email')),
  kind                text        NOT NULL CHECK (kind IN (
                                    'created',
                                    'updated',
                                    'cancelled',
                                    'reminder_24h',
                                    'reminder_1h',
                                    'reschedule_requested'
                                  )),
  scheduled_for       timestamptz NOT NULL,
  sent_at             timestamptz,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  provider_message_id text,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, channel, kind, scheduled_for)
);

CREATE INDEX IF NOT EXISTS coaching_appt_notif_deliveries_pending_idx
  ON public.coaching_appointment_notification_deliveries (appointment_id, status, scheduled_for)
  WHERE status = 'pending';

ALTER TABLE public.coaching_appointment_notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach reads own appointment deliveries"
  ON public.coaching_appointment_notification_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coaching_appointments ca
      WHERE ca.id = coaching_appointment_notification_deliveries.appointment_id
        AND ca.coach_id = auth.uid()
    )
  );

-- ── 4. Lien avec le Kanban ────────────────────────────────────────────────────

ALTER TABLE public.kanban_tasks
  ADD COLUMN IF NOT EXISTS appointment_id uuid
  REFERENCES public.coaching_appointments(id) ON DELETE SET NULL;

-- ── 5. Extension du type de notification ─────────────────────────────────────
-- Ajoute 'appointment' au check existant sur coach_client_notifications.type
-- On doit recréer la contrainte car ALTER TABLE … ADD CONSTRAINT sur CHECK
-- n'est pas supporté en remplacement direct sous PostgreSQL < 15.

DO $$
BEGIN
  -- Supprime l'ancienne contrainte de type si elle existe
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coach_client_notifications_type_check'
      AND conrelid = 'public.coach_client_notifications'::regclass
  ) THEN
    ALTER TABLE public.coach_client_notifications
      DROP CONSTRAINT coach_client_notifications_type_check;
  END IF;

  -- Ajoute la nouvelle contrainte avec 'appointment'
  ALTER TABLE public.coach_client_notifications
    ADD CONSTRAINT coach_client_notifications_type_check
    CHECK (type IN (
      'program_assigned',
      'program_updated',
      'system_reminder',
      'tdee_updated',
      'tdee_coach_alert',
      'coach_feedback',
      'coach_note',
      'coach_message',
      'bilan_pending',
      'client_reaction',
      'appointment'
    ));
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- Table absente dans les tests : on continue
END;
$$;
