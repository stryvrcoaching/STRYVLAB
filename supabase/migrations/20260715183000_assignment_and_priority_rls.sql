ALTER TABLE public.client_nutrition_protocol_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_workout_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_client_priority_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_nutrition_protocol_assignments FROM anon;
REVOKE ALL ON TABLE public.client_workout_program_assignments FROM anon;
REVOKE ALL ON TABLE public.coach_client_priority_states FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.client_nutrition_protocol_assignments,
           public.client_workout_program_assignments,
           public.coach_client_priority_states
  FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.client_nutrition_protocol_assignments,
           public.client_workout_program_assignments,
           public.coach_client_priority_states
  TO authenticated;

DROP POLICY IF EXISTS "coach_manage_nutrition_assignments" ON public.client_nutrition_protocol_assignments;
CREATE POLICY "coach_manage_nutrition_assignments"
  ON public.client_nutrition_protocol_assignments
  FOR ALL
  TO authenticated
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_nutrition_protocol_assignments.client_id
        AND client.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_nutrition_protocol_assignments.client_id
        AND client.coach_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.nutrition_protocols protocol
      WHERE protocol.id = client_nutrition_protocol_assignments.protocol_id
        AND protocol.coach_id = auth.uid()
        AND protocol.client_id = client_nutrition_protocol_assignments.client_id
    )
  );

DROP POLICY IF EXISTS "client_read_own_nutrition_assignments" ON public.client_nutrition_protocol_assignments;
CREATE POLICY "client_read_own_nutrition_assignments"
  ON public.client_nutrition_protocol_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_nutrition_protocol_assignments.client_id
        AND client.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "coach_manage_workout_assignments" ON public.client_workout_program_assignments;
CREATE POLICY "coach_manage_workout_assignments"
  ON public.client_workout_program_assignments
  FOR ALL
  TO authenticated
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_workout_program_assignments.client_id
        AND client.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_workout_program_assignments.client_id
        AND client.coach_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.programs program
      WHERE program.id = client_workout_program_assignments.program_id
        AND program.coach_id = auth.uid()
        AND program.client_id = client_workout_program_assignments.client_id
    )
  );

DROP POLICY IF EXISTS "client_read_own_workout_assignments" ON public.client_workout_program_assignments;
CREATE POLICY "client_read_own_workout_assignments"
  ON public.client_workout_program_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_workout_program_assignments.client_id
        AND client.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "coach_manage_priority_states" ON public.coach_client_priority_states;
CREATE POLICY "coach_manage_priority_states"
  ON public.coach_client_priority_states
  FOR ALL
  TO authenticated
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = coach_client_priority_states.client_id
        AND client.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = coach_client_priority_states.client_id
        AND client.coach_id = auth.uid()
    )
  );
