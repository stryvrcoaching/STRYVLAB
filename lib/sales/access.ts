import { NextResponse } from 'next/server'
import { createDashboardServiceClient } from '@/lib/dashboard/service'
import { createClient as createServerClient } from '@/utils/supabase/server'

export type SalesPartner = {
  id: string
  user_id: string
  full_name: string
  email: string
  status: 'active' | 'suspended'
}

export async function getSalesAccessForCurrentUser() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { user: null, partner: null }

  const { data } = await createDashboardServiceClient()
    .from('sales_partners')
    .select('id, user_id, full_name, email, status')
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, partner: (data as SalesPartner | null) ?? null }
}

export async function requireSalesAccess() {
  const access = await getSalesAccessForCurrentUser()

  if (!access.user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  if (!access.partner || access.partner.status !== 'active') {
    return { error: NextResponse.json({ error: 'Accès commercial indisponible' }, { status: 403 }) }
  }

  return {
    user: access.user,
    partner: access.partner,
    db: createDashboardServiceClient(),
  }
}
