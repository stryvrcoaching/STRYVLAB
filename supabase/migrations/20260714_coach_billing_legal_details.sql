-- Informations légales de l'émetteur, utilisées pour les reçus et factures coach.
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS billing_country text,
  ADD COLUMN IF NOT EXISTS business_registration_number text;

-- Les profils existants conservent leur SIRET dans le nouveau champ générique.
UPDATE public.coach_profiles
SET business_registration_number = siret
WHERE business_registration_number IS NULL
  AND siret IS NOT NULL;

ALTER TABLE public.coach_profiles
  DROP CONSTRAINT IF EXISTS coach_profiles_billing_country_check;

ALTER TABLE public.coach_profiles
  ADD CONSTRAINT coach_profiles_billing_country_check
  CHECK (billing_country IS NULL OR billing_country ~ '^[A-Z]{2}$');
