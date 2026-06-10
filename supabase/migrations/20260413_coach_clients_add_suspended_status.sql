-- Add 'suspended' to coach_clients status check constraint
-- Required for client access suspension feature (ban_duration + status='suspended')

ALTER TABLE coach_clients
  DROP CONSTRAINT IF EXISTS coach_clients_status_check;

ALTER TABLE coach_clients
  ADD CONSTRAINT coach_clients_status_check
  CHECK (status IN ('active', 'inactive', 'archived', 'suspended'));
