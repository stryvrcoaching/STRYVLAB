-- Profile photo reads and writes already use authorized service-role API routes.
DROP POLICY IF EXISTS "authenticated_read_profile_photos" ON storage.objects;
DROP POLICY IF EXISTS "client_upload_own_photo" ON storage.objects;
DROP POLICY IF EXISTS "client_update_own_photo" ON storage.objects;
DROP POLICY IF EXISTS "client_delete_own_photo" ON storage.objects;

CREATE POLICY "profile_photos_server_only"
  ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'profile-photos')
  WITH CHECK (bucket_id <> 'profile-photos');

-- Catalogue entries without a client belong to the shared library.
DROP POLICY IF EXISTS "food_items_select" ON public.food_items;
CREATE POLICY "food_items_shared_read"
  ON public.food_items FOR SELECT TO anon, authenticated
  USING (client_id IS NULL);

CREATE POLICY "food_items_related_client_read"
  ON public.food_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients AS client
    WHERE client.id = food_items.client_id
      AND (client.user_id = (SELECT auth.uid()) OR client.coach_id = (SELECT auth.uid()))
  ));

-- CRM reads belong to the internal server dashboard, public inserts remain enabled.
DROP POLICY IF EXISTS "beta_waitlist_select_authenticated" ON public.beta_waitlist;
REVOKE SELECT ON TABLE public.beta_waitlist FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.beta_waitlist TO service_role;
