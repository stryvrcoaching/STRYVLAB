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
    'id'
  )
  if (!cc) return null

  return <MetricsClientPage />
}
