-- Run against a local Supabase test database with psql -v ON_ERROR_STOP=1.
-- All fixtures and changes are rolled back, including failed assertions.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'security-coach-a@example.invalid'),
  ('a0000000-0000-4000-8000-000000000002', 'security-coach-b@example.invalid'),
  ('b0000000-0000-4000-8000-000000000001', 'security-client-a@example.invalid'),
  ('b0000000-0000-4000-8000-000000000002', 'security-client-b@example.invalid');

INSERT INTO public.coach_clients (id, coach_id, user_id, first_name, last_name) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Fixture A', 'Security'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Fixture B', 'Security');

INSERT INTO public.food_items
  (name_fr, category_l1, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, is_verified, client_id)
VALUES
  ('Fixture shared', 'extras', 'security-isolation-shared', 100, 0, 25, 0, 0, 'user', false, NULL),
  ('Fixture A', 'extras', 'security-isolation-a', 100, 0, 25, 0, 0, 'user', false, 'c0000000-0000-4000-8000-000000000001'),
  ('Fixture B', 'extras', 'security-isolation-b', 100, 0, 25, 0, 0, 'user', false, 'c0000000-0000-4000-8000-000000000002');

INSERT INTO storage.objects (bucket_id, name) VALUES
  ('profile-photos', 'c0000000-0000-4000-8000-000000000001/security-isolation-avatar'),
  ('profile-photos', 'c0000000-0000-4000-8000-000000000002/security-isolation-avatar');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.food_items WHERE item_key LIKE 'security-isolation-%') = 1,
    'Anonymous access must only see the shared food catalogue';
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'profile-photos') = 0,
    'Anonymous access must not read profile photos';
END $$;
INSERT INTO public.beta_waitlist (first_name, email)
VALUES ('Security fixture', 'security-waitlist@example.invalid');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000001"}', true);
DO $$ BEGIN
  ASSERT (SELECT array_agg(item_key ORDER BY item_key) FROM public.food_items WHERE item_key LIKE 'security-isolation-%')
    = ARRAY['security-isolation-a', 'security-isolation-shared'], 'Client A must only see their own and shared foods';
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'profile-photos') = 0,
    'Profile photos must use the authorized server route';
  BEGIN
    PERFORM 1 FROM public.beta_waitlist LIMIT 1;
    RAISE EXCEPTION 'Authenticated accounts must not read the waitlist';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('profile-photos', 'security-isolation-unauthorized');
    RAISE EXCEPTION 'Authenticated accounts must not upload profile photos directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE storage.objects SET name = 'security-isolation-replaced'
    WHERE bucket_id = 'profile-photos';
  ASSERT NOT FOUND, 'Authenticated accounts must not replace profile photos directly';
  DELETE FROM storage.objects WHERE bucket_id = 'profile-photos';
  ASSERT NOT FOUND, 'Authenticated accounts must not delete profile photos directly';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}', true);
DO $$ BEGIN
  ASSERT (SELECT array_agg(item_key ORDER BY item_key) FROM public.food_items WHERE item_key LIKE 'security-isolation-%')
    = ARRAY['security-isolation-b', 'security-isolation-shared'], 'Client B must only see their own and shared foods';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', true);
DO $$ BEGIN
  ASSERT (SELECT array_agg(item_key ORDER BY item_key) FROM public.food_items WHERE item_key LIKE 'security-isolation-%')
    = ARRAY['security-isolation-a', 'security-isolation-shared'], 'Coach A must only see their clients and shared foods';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000002"}', true);
DO $$ BEGIN
  ASSERT (SELECT array_agg(item_key ORDER BY item_key) FROM public.food_items WHERE item_key LIKE 'security-isolation-%')
    = ARRAY['security-isolation-b', 'security-isolation-shared'], 'Coach B must only see their clients and shared foods';
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'profile-photos' AND name LIKE '%/security-isolation-avatar') = 2,
    'Server routes must retain access to profile photos';
  ASSERT (SELECT count(*) FROM public.food_items WHERE item_key LIKE 'security-isolation-%') = 3,
    'Server routes must retain access to all food fixtures';
  ASSERT (SELECT count(*) FROM public.beta_waitlist WHERE email = 'security-waitlist@example.invalid') = 1,
    'Internal operations must retain access to new waitlist entries';
END $$;
RESET ROLE;

ROLLBACK;
