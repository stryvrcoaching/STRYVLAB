ALTER TABLE coach_client_notifications
  DROP CONSTRAINT IF EXISTS coach_client_notifications_type_check;

ALTER TABLE coach_client_notifications
  ADD CONSTRAINT coach_client_notifications_type_check
  CHECK (type IN (
    'coach_note',
    'coach_message',
    'bilan_pending',
    'program_assigned',
    'program_updated',
    'system_reminder',
    'tdee_updated',
    'coach_feedback'
  ));
