import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import MetricsClientPage from "@/components/client/MetricsClientPage"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function MetricsRoute() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/client/login')

  const db = service()
  const cc = await resolveClientFromUser(
    user.id,
    user.email,
    db,
    'id, first_name, last_name, email, profile_photo_url'
  )
  if (!cc) return null

  const firstName = (cc as any).first_name ?? ""
  const lastName  = (cc as any).last_name  ?? ""
  const initials  = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?"

  const { data: streakRow } = await db
    .from('client_streaks')
    .select('current_streak')
    .eq('client_id', cc.id)
    .maybeSingle()

  return (
    <MetricsClientPage
      clientName={`${firstName} ${lastName}`.trim()}
      clientEmail={(cc as any).email ?? user.email ?? ""}
      avatarInitials={initials}
      avatarUrl={(cc as any).profile_photo_url ?? null}
      streak={(streakRow as any)?.current_streak ?? 0}
    />
  )
}
