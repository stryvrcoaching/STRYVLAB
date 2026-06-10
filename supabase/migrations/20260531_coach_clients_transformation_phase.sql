-- Canonical transformation phase for cross-ecosystem strategy alignment

alter table public.coach_clients
  add column if not exists transformation_phase text
  check (
    transformation_phase in (
      'cut',
      'aggressive_cut',
      'maintenance',
      'recomp',
      'lean_bulk',
      'mass_gain',
      'diet_break',
      'peak_week'
    )
  );

comment on column public.coach_clients.transformation_phase
  is 'Coach-selected transformation phase driving nutrition, phase optimization, and client strategy alignment.';
