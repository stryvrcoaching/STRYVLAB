-- Migration: add timezone column to coach_clients
-- Allows storing client-specific timezone for correct date handling

ALTER TABLE public.coach_clients
ADD COLUMN IF NOT EXISTS timezone TEXT; -- e.g., 'Europe/Paris'

-- Optional: set default to null (already default). No further data migration needed.
