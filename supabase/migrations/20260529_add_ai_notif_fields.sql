-- Migration: Add missing AI notification and escalation columns to coach_profiles
ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS ai_notif_email          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_notif_sms            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_escalation_threshold integer;
