import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function requireCoachDocsAccess() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: coachProfile } = await service()
    .from('coach_profiles')
    .select('id')
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!coachProfile) notFound()
  return user
}

export async function requireClientDocsAccess() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const client = await resolveClientFromUser(user.id, user.email, service(), 'id')
  if (!client?.id) notFound()
  return { user, client }
}
