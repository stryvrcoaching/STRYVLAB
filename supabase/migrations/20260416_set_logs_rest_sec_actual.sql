-- ============================================================
-- client_set_logs — temps de repos effectif
--
-- Capturé par le chrono inversé du SessionLogger.
-- Inclut l'overtime si le client dépasse le temps prescrit.
-- ============================================================

alter table public.client_set_logs
  add column if not exists rest_sec_actual int;

comment on column public.client_set_logs.rest_sec_actual is
  'Temps de repos effectif en secondes après ce set — capturé par le chrono inversé du SessionLogger. Inclut l''overtime si le client a dépassé le temps prescrit.';
