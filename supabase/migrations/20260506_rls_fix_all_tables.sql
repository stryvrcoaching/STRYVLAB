-- ============================================================
-- RLS FIX — Activer RLS sur toutes les tables publiques
-- Basé sur la liste réelle des tables en DB (2026-05-06)
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- GROUPE 1 : TABLES RÉFÉRENTIELLES (lecture publique OK)
-- Pas de données personnelles — catalogue d'exercices, muscles, etc.
-- RLS activé mais accès SELECT ouvert à tous les authenticated
-- ============================================================

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercises_read" ON public.exercises;
CREATE POLICY "exercises_read" ON public.exercises FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exercise_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_translations_read" ON public.exercise_translations;
CREATE POLICY "exercise_translations_read" ON public.exercise_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exercise_target_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_target_contributions_read" ON public.exercise_target_contributions;
CREATE POLICY "exercise_target_contributions_read" ON public.exercise_target_contributions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exercise_constraints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_constraints_read" ON public.exercise_constraints;
CREATE POLICY "exercise_constraints_read" ON public.exercise_constraints FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exercise_environments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_environments_read" ON public.exercise_environments;
CREATE POLICY "exercise_environments_read" ON public.exercise_environments FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exercise_equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_equipment_read" ON public.exercise_equipment;
CREATE POLICY "exercise_equipment_read" ON public.exercise_equipment FOR SELECT TO authenticated USING (true);

ALTER TABLE public.exercise_substitutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise_substitutions_read" ON public.exercise_substitutions;
CREATE POLICY "exercise_substitutions_read" ON public.exercise_substitutions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.muscles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscles_read" ON public.muscles;
CREATE POLICY "muscles_read" ON public.muscles FOR SELECT TO authenticated USING (true);

ALTER TABLE public.muscle_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscle_translations_read" ON public.muscle_translations;
CREATE POLICY "muscle_translations_read" ON public.muscle_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.muscle_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscle_groups_read" ON public.muscle_groups;
CREATE POLICY "muscle_groups_read" ON public.muscle_groups FOR SELECT TO authenticated USING (true);

ALTER TABLE public.muscle_group_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscle_group_translations_read" ON public.muscle_group_translations;
CREATE POLICY "muscle_group_translations_read" ON public.muscle_group_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.muscle_regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscle_regions_read" ON public.muscle_regions;
CREATE POLICY "muscle_regions_read" ON public.muscle_regions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.muscle_region_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscle_region_translations_read" ON public.muscle_region_translations;
CREATE POLICY "muscle_region_translations_read" ON public.muscle_region_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.trainable_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trainable_targets_read" ON public.trainable_targets;
CREATE POLICY "trainable_targets_read" ON public.trainable_targets FOR SELECT TO authenticated USING (true);

ALTER TABLE public.trainable_target_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trainable_target_translations_read" ON public.trainable_target_translations;
CREATE POLICY "trainable_target_translations_read" ON public.trainable_target_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.movement_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movement_patterns_read" ON public.movement_patterns;
CREATE POLICY "movement_patterns_read" ON public.movement_patterns FOR SELECT TO authenticated USING (true);

ALTER TABLE public.movement_pattern_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movement_pattern_translations_read" ON public.movement_pattern_translations;
CREATE POLICY "movement_pattern_translations_read" ON public.movement_pattern_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_read" ON public.equipment;
CREATE POLICY "equipment_read" ON public.equipment FOR SELECT TO authenticated USING (true);

ALTER TABLE public.equipment_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_translations_read" ON public.equipment_translations;
CREATE POLICY "equipment_translations_read" ON public.equipment_translations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "environments_read" ON public.environments;
CREATE POLICY "environments_read" ON public.environments FOR SELECT TO authenticated USING (true);

ALTER TABLE public.environment_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "environment_translations_read" ON public.environment_translations;
CREATE POLICY "environment_translations_read" ON public.environment_translations FOR SELECT TO authenticated USING (true);

-- ============================================================
-- GROUPE 2 : TABLES ORGANIZATION / COACH (Prisma schema)
-- ============================================================

-- organizations : lecture par membres authentifiés
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_read" ON public.organizations;
CREATE POLICY "org_members_read" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaches c WHERE c."organizationId" = organizations.id AND c."userId" = auth.uid()::text
    )
  );

-- coaches : un coach voit son propre profil
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_own_profile" ON public.coaches;
CREATE POLICY "coach_own_profile" ON public.coaches
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

-- users : chaque user voit son propre enregistrement
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_record" ON public.users;
CREATE POLICY "user_own_record" ON public.users
  FOR ALL TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- ============================================================
-- GROUPE 3 : TABLES CLIENT (Prisma schema — camelCase)
-- ============================================================

-- clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_own_clients" ON public.clients;
CREATE POLICY "coach_sees_own_clients" ON public.clients
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c."organizationId" = clients."organizationId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_record" ON public.clients;
CREATE POLICY "client_own_record" ON public.clients
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text);

-- client_goals
ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_goals" ON public.client_goals;
CREATE POLICY "coach_sees_client_goals" ON public.client_goals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = client_goals."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_goals" ON public.client_goals;
CREATE POLICY "client_own_goals" ON public.client_goals
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = client_goals."clientId" AND cl."userId" = auth.uid()::text)
  );

-- client_intakes
ALTER TABLE public.client_intakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_intakes" ON public.client_intakes;
CREATE POLICY "coach_sees_client_intakes" ON public.client_intakes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = client_intakes."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_intakes" ON public.client_intakes;
CREATE POLICY "client_own_intakes" ON public.client_intakes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = client_intakes."clientId" AND cl."userId" = auth.uid()::text)
  );

-- client_constraints
ALTER TABLE public.client_constraints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_constraints" ON public.client_constraints;
CREATE POLICY "coach_sees_client_constraints" ON public.client_constraints
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = client_constraints."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_constraints" ON public.client_constraints;
CREATE POLICY "client_own_constraints" ON public.client_constraints
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = client_constraints."clientId" AND cl."userId" = auth.uid()::text)
  );

-- client_environment_access
ALTER TABLE public.client_environment_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_env_access" ON public.client_environment_access;
CREATE POLICY "coach_sees_client_env_access" ON public.client_environment_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = client_environment_access."clientId" AND c."userId" = auth.uid()::text
    )
  );

-- client_equipment_access
ALTER TABLE public.client_equipment_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_equipment_access" ON public.client_equipment_access;
CREATE POLICY "coach_sees_client_equipment_access" ON public.client_equipment_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = client_equipment_access."clientId" AND c."userId" = auth.uid()::text
    )
  );

-- client_target_priorities
ALTER TABLE public.client_target_priorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_target_priorities" ON public.client_target_priorities;
CREATE POLICY "coach_sees_client_target_priorities" ON public.client_target_priorities
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = client_target_priorities."clientId" AND c."userId" = auth.uid()::text
    )
  );

-- body_metrics
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_body_metrics" ON public.body_metrics;
CREATE POLICY "coach_sees_body_metrics" ON public.body_metrics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = body_metrics."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_body_metrics" ON public.body_metrics;
CREATE POLICY "client_own_body_metrics" ON public.body_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = body_metrics."clientId" AND cl."userId" = auth.uid()::text)
  );

-- weekly_feedbacks
ALTER TABLE public.weekly_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_weekly_feedbacks" ON public.weekly_feedbacks;
CREATE POLICY "coach_sees_weekly_feedbacks" ON public.weekly_feedbacks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = weekly_feedbacks."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_weekly_feedbacks" ON public.weekly_feedbacks;
CREATE POLICY "client_own_weekly_feedbacks" ON public.weekly_feedbacks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = weekly_feedbacks."clientId" AND cl."userId" = auth.uid()::text)
  );

-- photo_sets
ALTER TABLE public.photo_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_photo_sets" ON public.photo_sets;
CREATE POLICY "coach_sees_photo_sets" ON public.photo_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = photo_sets."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_photo_sets" ON public.photo_sets;
CREATE POLICY "client_own_photo_sets" ON public.photo_sets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = photo_sets."clientId" AND cl."userId" = auth.uid()::text)
  );

-- progress_photos
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_progress_photos" ON public.progress_photos;
CREATE POLICY "coach_sees_progress_photos" ON public.progress_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients cl
      JOIN public.coaches c ON c."organizationId" = cl."organizationId"
      WHERE cl.id = progress_photos."clientId" AND c."userId" = auth.uid()::text
    )
  );
DROP POLICY IF EXISTS "client_own_progress_photos" ON public.progress_photos;
CREATE POLICY "client_own_progress_photos" ON public.progress_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = progress_photos."clientId" AND cl."userId" = auth.uid()::text)
  );

-- ============================================================
-- GROUPE 4 : PROGRAMMES (Prisma schema — camelCase)
-- ============================================================

-- programs : snake_case uuid (table legacy)
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_programs_prisma" ON public.programs;
CREATE POLICY "coach_owns_programs_prisma" ON public.programs
  FOR ALL TO authenticated
  USING (coach_id = auth.uid());
DROP POLICY IF EXISTS "client_sees_own_programs" ON public.programs;
CREATE POLICY "client_sees_own_programs" ON public.programs
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- sessions : programId text → join programs.id uuid via cast
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_sessions_prisma" ON public.sessions;
CREATE POLICY "coach_owns_sessions_prisma" ON public.sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id::text = sessions."programId" AND p.coach_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "client_sees_own_sessions" ON public.sessions;
CREATE POLICY "client_sees_own_sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id::text = sessions."programId" AND p.client_id = auth.uid()
    )
  );

-- working_sets : sessionId text → join sessions → programs.coach_id uuid
ALTER TABLE public.working_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_working_sets" ON public.working_sets;
CREATE POLICY "coach_owns_working_sets" ON public.working_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.programs p ON p.id::text = s."programId"
      WHERE s.id = working_sets."sessionId" AND p.coach_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "client_sees_own_working_sets" ON public.working_sets;
CREATE POLICY "client_sees_own_working_sets" ON public.working_sets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.programs p ON p.id::text = s."programId"
      WHERE s.id = working_sets."sessionId" AND p.client_id = auth.uid()
    )
  );

-- program_target_allocations : programId text → programs.id uuid
ALTER TABLE public.program_target_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_target_allocations" ON public.program_target_allocations;
CREATE POLICY "coach_owns_target_allocations" ON public.program_target_allocations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id::text = program_target_allocations."programId" AND p.coach_id = auth.uid()
    )
  );

-- program_translations : programId text → programs.id uuid
ALTER TABLE public.program_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_program_translations" ON public.program_translations;
CREATE POLICY "coach_owns_program_translations" ON public.program_translations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id::text = program_translations."programId" AND p.coach_id = auth.uid()
    )
  );

-- coach_programs (legacy/duplicate?)
ALTER TABLE public.coach_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_coach_programs" ON public.coach_programs;
CREATE POLICY "coach_owns_coach_programs" ON public.coach_programs
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- coach_program_sessions (legacy)
ALTER TABLE public.coach_program_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_coach_program_sessions" ON public.coach_program_sessions;
CREATE POLICY "coach_owns_coach_program_sessions" ON public.coach_program_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_programs cp WHERE cp.id = coach_program_sessions.program_id AND cp.coach_id = auth.uid()
    )
  );

-- coach_program_exercises (legacy)
ALTER TABLE public.coach_program_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_coach_program_exercises" ON public.coach_program_exercises;
CREATE POLICY "coach_owns_coach_program_exercises" ON public.coach_program_exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_program_sessions cps
      JOIN public.coach_programs cp ON cp.id = cps.program_id
      WHERE cps.id = coach_program_exercises.session_id AND cp.coach_id = auth.uid()
    )
  );

-- programs_prisma_backup (backup table — fermer l'accès)
ALTER TABLE public.programs_prisma_backup ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUPE 5 : TABLES LEGACY (coach_clients schema)
-- Déjà auditées — forcer ENABLE + policies existantes dans migrations
-- ============================================================

ALTER TABLE public.coach_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_program_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_program_template_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_program_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morpho_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_template_exercise_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_adjustment_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morpho_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morpho_annotations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUPE 6 : NOUVELLES TABLES (policies générées ici)
-- ============================================================

-- coach_formulas
ALTER TABLE public.coach_formulas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_formulas" ON public.coach_formulas;
CREATE POLICY "coach_owns_formulas" ON public.coach_formulas
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- coach_tags
ALTER TABLE public.coach_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_tags" ON public.coach_tags;
CREATE POLICY "coach_owns_tags" ON public.coach_tags
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- coach_custom_exercises
ALTER TABLE public.coach_custom_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_custom_exercises" ON public.coach_custom_exercises;
CREATE POLICY "coach_owns_custom_exercises" ON public.coach_custom_exercises
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- coach_meal_templates
ALTER TABLE public.coach_meal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_meal_templates" ON public.coach_meal_templates;
CREATE POLICY "coach_owns_meal_templates" ON public.coach_meal_templates
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- kanban_boards
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_kanban_boards" ON public.kanban_boards;
CREATE POLICY "coach_owns_kanban_boards" ON public.kanban_boards
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- kanban_columns
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_kanban_columns" ON public.kanban_columns;
CREATE POLICY "coach_owns_kanban_columns" ON public.kanban_columns
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- kanban_tasks
ALTER TABLE public.kanban_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_kanban_tasks" ON public.kanban_tasks;
CREATE POLICY "coach_owns_kanban_tasks" ON public.kanban_tasks
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- agenda_events
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_agenda_events" ON public.agenda_events;
CREATE POLICY "coach_owns_agenda_events" ON public.agenda_events
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- daily_checkin_configs
ALTER TABLE public.daily_checkin_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_checkin_configs" ON public.daily_checkin_configs;
CREATE POLICY "coach_owns_checkin_configs" ON public.daily_checkin_configs
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- client_subscriptions
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_subscriptions" ON public.client_subscriptions;
CREATE POLICY "coach_owns_subscriptions" ON public.client_subscriptions
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_subscription_payments" ON public.subscription_payments;
CREATE POLICY "coach_owns_subscription_payments" ON public.subscription_payments
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- training_phases
ALTER TABLE public.training_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_training_phases" ON public.training_phases;
CREATE POLICY "coach_owns_training_phases" ON public.training_phases
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- metric_annotations
ALTER TABLE public.metric_annotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_metric_annotations" ON public.metric_annotations;
CREATE POLICY "coach_owns_metric_annotations" ON public.metric_annotations
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- client_tags (join via coach_clients)
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_client_tags" ON public.client_tags;
CREATE POLICY "coach_owns_client_tags" ON public.client_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = client_tags.client_id AND cc.coach_id = auth.uid()));

-- daily_checkin_schedules
ALTER TABLE public.daily_checkin_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_checkin_schedules" ON public.daily_checkin_schedules;
CREATE POLICY "coach_owns_checkin_schedules" ON public.daily_checkin_schedules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = daily_checkin_schedules.client_id AND cc.coach_id = auth.uid()));
DROP POLICY IF EXISTS "client_own_checkin_schedules" ON public.daily_checkin_schedules;
CREATE POLICY "client_own_checkin_schedules" ON public.daily_checkin_schedules
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = daily_checkin_schedules.client_id AND cc.user_id = auth.uid()));

-- daily_checkin_responses
ALTER TABLE public.daily_checkin_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkin_responses" ON public.daily_checkin_responses;
CREATE POLICY "coach_sees_checkin_responses" ON public.daily_checkin_responses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = daily_checkin_responses.client_id AND cc.coach_id = auth.uid()));
DROP POLICY IF EXISTS "client_own_checkin_responses" ON public.daily_checkin_responses;
CREATE POLICY "client_own_checkin_responses" ON public.daily_checkin_responses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = daily_checkin_responses.client_id AND cc.user_id = auth.uid()));

-- meal_logs
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_meal_logs" ON public.meal_logs;
CREATE POLICY "coach_sees_meal_logs" ON public.meal_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = meal_logs.client_id AND cc.coach_id = auth.uid()));
DROP POLICY IF EXISTS "client_own_meal_logs" ON public.meal_logs;
CREATE POLICY "client_own_meal_logs" ON public.meal_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = meal_logs.client_id AND cc.user_id = auth.uid()));

-- client_points
ALTER TABLE public.client_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_points" ON public.client_points;
CREATE POLICY "coach_sees_client_points" ON public.client_points
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = client_points.client_id AND cc.coach_id = auth.uid()));
DROP POLICY IF EXISTS "client_own_points" ON public.client_points;
CREATE POLICY "client_own_points" ON public.client_points
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = client_points.client_id AND cc.user_id = auth.uid()));

-- client_streaks
ALTER TABLE public.client_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_client_streaks" ON public.client_streaks;
CREATE POLICY "coach_sees_client_streaks" ON public.client_streaks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = client_streaks.client_id AND cc.coach_id = auth.uid()));
DROP POLICY IF EXISTS "client_own_streaks" ON public.client_streaks;
CREATE POLICY "client_own_streaks" ON public.client_streaks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = client_streaks.client_id AND cc.user_id = auth.uid()));

-- nutrition_protocols
ALTER TABLE public.nutrition_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_nutrition_protocols" ON public.nutrition_protocols;
CREATE POLICY "coach_owns_nutrition_protocols" ON public.nutrition_protocols
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = nutrition_protocols.client_id AND cc.coach_id = auth.uid()));
DROP POLICY IF EXISTS "client_sees_shared_protocols" ON public.nutrition_protocols;
CREATE POLICY "client_sees_shared_protocols" ON public.nutrition_protocols
  FOR SELECT TO authenticated
  USING (
    status = 'shared' AND
    EXISTS (SELECT 1 FROM public.coach_clients cc WHERE cc.id = nutrition_protocols.client_id AND cc.user_id = auth.uid())
  );

-- nutrition_protocol_days
ALTER TABLE public.nutrition_protocol_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_protocol_days" ON public.nutrition_protocol_days;
CREATE POLICY "coach_owns_protocol_days" ON public.nutrition_protocol_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nutrition_protocols np
      JOIN public.coach_clients cc ON cc.id = np.client_id
      WHERE np.id = nutrition_protocol_days.protocol_id AND cc.coach_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "client_sees_shared_protocol_days" ON public.nutrition_protocol_days;
CREATE POLICY "client_sees_shared_protocol_days" ON public.nutrition_protocol_days
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nutrition_protocols np
      JOIN public.coach_clients cc ON cc.id = np.client_id
      WHERE np.id = nutrition_protocol_days.protocol_id AND np.status = 'shared' AND cc.user_id = auth.uid()
    )
  );

-- ============================================================
-- GROUPE 7 : CHECKINS LEGACY (ancien système)
-- Accès coach via ownership + client via user_id
-- ============================================================

-- checkins : colonnes camelCase text (Prisma)
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkins" ON public.checkins;
CREATE POLICY "coach_sees_checkins" ON public.checkins
  FOR ALL TO authenticated
  USING ("coachId" = auth.uid()::text);
DROP POLICY IF EXISTS "client_own_checkins" ON public.checkins;
CREATE POLICY "client_own_checkins" ON public.checkins
  FOR ALL TO authenticated
  USING ("clientId" = auth.uid()::text);

-- checkin_templates : coachId text (Prisma)
ALTER TABLE public.checkin_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_checkin_templates" ON public.checkin_templates;
CREATE POLICY "coach_owns_checkin_templates" ON public.checkin_templates
  FOR ALL TO authenticated
  USING ("coachId" = auth.uid()::text)
  WITH CHECK ("coachId" = auth.uid()::text);

-- checkin_template_modules : join via checkin_templates."coachId" (text)
ALTER TABLE public.checkin_template_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_checkin_template_modules" ON public.checkin_template_modules;
CREATE POLICY "coach_owns_checkin_template_modules" ON public.checkin_template_modules
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkin_templates ct
    WHERE ct.id = checkin_template_modules."templateId" AND ct."coachId" = auth.uid()::text
  ));

-- checkin_template_fields : join via modules → templates
ALTER TABLE public.checkin_template_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_checkin_template_fields" ON public.checkin_template_fields;
CREATE POLICY "coach_owns_checkin_template_fields" ON public.checkin_template_fields
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checkin_template_modules ctm
      JOIN public.checkin_templates ct ON ct.id = ctm."templateId"
      WHERE ctm.id = checkin_template_fields."moduleId" AND ct."coachId" = auth.uid()::text
    )
  );

-- checkin_template_translations
ALTER TABLE public.checkin_template_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_owns_checkin_template_translations" ON public.checkin_template_translations;
CREATE POLICY "coach_owns_checkin_template_translations" ON public.checkin_template_translations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkin_templates ct
    WHERE ct.id = checkin_template_translations."templateId" AND ct."coachId" = auth.uid()::text
  ));

-- checkin_tokens : checkInId (capital I)
ALTER TABLE public.checkin_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkin_tokens" ON public.checkin_tokens;
CREATE POLICY "coach_sees_checkin_tokens" ON public.checkin_tokens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_tokens."checkInId" AND c."coachId" = auth.uid()::text
  ));

-- checkin_field_responses : checkInId (capital I), no clientId
ALTER TABLE public.checkin_field_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkin_field_responses" ON public.checkin_field_responses;
CREATE POLICY "coach_sees_checkin_field_responses" ON public.checkin_field_responses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_field_responses."checkInId" AND c."coachId" = auth.uid()::text
  ));
DROP POLICY IF EXISTS "client_own_checkin_field_responses" ON public.checkin_field_responses;
CREATE POLICY "client_own_checkin_field_responses" ON public.checkin_field_responses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_field_responses."checkInId" AND c."clientId" = auth.uid()::text
  ));

-- checkin_measurements : checkInId (capital I) + clientId
ALTER TABLE public.checkin_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkin_measurements" ON public.checkin_measurements;
CREATE POLICY "coach_sees_checkin_measurements" ON public.checkin_measurements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_measurements."checkInId" AND c."coachId" = auth.uid()::text
  ));
DROP POLICY IF EXISTS "client_own_checkin_measurements" ON public.checkin_measurements;
CREATE POLICY "client_own_checkin_measurements" ON public.checkin_measurements
  FOR SELECT TO authenticated
  USING ("clientId" = auth.uid()::text);

-- checkin_photos : checkInId (capital I)
ALTER TABLE public.checkin_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkin_photos" ON public.checkin_photos;
CREATE POLICY "coach_sees_checkin_photos" ON public.checkin_photos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_photos."checkInId" AND c."coachId" = auth.uid()::text
  ));

-- checkin_scores : checkInId (capital I) + clientId
ALTER TABLE public.checkin_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_sees_checkin_scores" ON public.checkin_scores;
CREATE POLICY "coach_sees_checkin_scores" ON public.checkin_scores
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.id = checkin_scores."checkInId" AND c."coachId" = auth.uid()::text
  ));
DROP POLICY IF EXISTS "client_own_checkin_scores" ON public.checkin_scores;
CREATE POLICY "client_own_checkin_scores" ON public.checkin_scores
  FOR SELECT TO authenticated
  USING ("clientId" = auth.uid()::text);

-- ============================================================
-- VÉRIFICATION FINALE — coller après exécution
-- ============================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false
-- ORDER BY tablename;
-- Résultat attendu : 0 lignes
-- ============================================================
