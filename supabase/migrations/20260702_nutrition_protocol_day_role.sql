ALTER TABLE public.nutrition_protocol_days
ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE public.nutrition_protocol_days
SET role = CASE
  WHEN lower(name) ~ 'entra[îi]n|training|sport|muscu|push|pull|legs|jambe|perf' THEN 'training'
  WHEN lower(name) ~ 'repos|rest|recovery|off|regen|recup|récup|deload' THEN 'rest'
  WHEN carb_cycle_type = 'high' THEN 'training'
  WHEN carb_cycle_type = 'low' THEN 'rest'
  ELSE 'neutral'
END
WHERE role IS NULL;

ALTER TABLE public.nutrition_protocol_days
ALTER COLUMN role SET DEFAULT 'neutral';

UPDATE public.nutrition_protocol_days
SET role = 'neutral'
WHERE role IS NULL;

ALTER TABLE public.nutrition_protocol_days
ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.nutrition_protocol_days
DROP CONSTRAINT IF EXISTS nutrition_protocol_days_role_check;

ALTER TABLE public.nutrition_protocol_days
ADD CONSTRAINT nutrition_protocol_days_role_check
CHECK (role IN ('training', 'rest', 'neutral'));
