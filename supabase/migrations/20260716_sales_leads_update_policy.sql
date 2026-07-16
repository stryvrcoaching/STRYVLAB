CREATE POLICY "sales_leads_update_own"
  ON public.sales_leads FOR UPDATE
  USING (
    sales_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
    OR closing_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    sales_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
    OR closing_partner_id IN (
      SELECT id FROM public.sales_partners WHERE user_id = auth.uid() AND status = 'active'
    )
  );
