import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import ChatPage from "@/components/client/ChatPage"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getFreshCoachAvatarUrl(db: ReturnType<typeof service>, coachId: string): Promise<string | null> {
  // List files in the coach's storage folder to find their logo regardless of extension
  const { data: files } = await db.storage
    .from('coach-assets')
    .list(coachId, { limit: 10 })

  const logoFile = files?.find(f => f.name.startsWith('logo'))
  if (!logoFile) return null

  // Generate a fresh signed URL (1 hour — regenerated on each page load)
  const { data: signed } = await db.storage
    .from('coach-assets')
    .createSignedUrl(`${coachId}/${logoFile.name}`, 3600)

  return signed?.signedUrl ?? null
}

export default async function ClientHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let firstName: string | null = null
  let coachAvatarUrl: string | null = null
  let coachInitial: string | null = null

  if (user) {
    const db = service()
    const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name, coach_id')
    firstName = (cc as any)?.first_name ?? null

    const coachId = (cc as any)?.coach_id ?? null
    if (coachId) {
      const coachProfile = await db.from('coach_profiles')
        .select('full_name, logo_url')
        .eq('coach_id', coachId)
        .maybeSingle()

      const coachFullName: string | null = (coachProfile.data as any)?.full_name ?? null
      const storedLogoUrl: string | null = (coachProfile.data as any)?.logo_url ?? null
      coachInitial = coachFullName ? coachFullName.trim().charAt(0).toUpperCase() : null
      // Use stored 10-year signed URL; regenerate from storage only if missing
      coachAvatarUrl = storedLogoUrl ?? await getFreshCoachAvatarUrl(db, coachId)
    }
  }

  return <ChatPage coachAvatarUrl={coachAvatarUrl} coachInitial={coachInitial} clientFirstName={firstName} />
}
