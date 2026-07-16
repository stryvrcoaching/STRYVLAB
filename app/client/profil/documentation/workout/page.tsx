import ClientTopBar from '@/components/client/ClientTopBar'
import DocsIndexPage from '@/components/docs/DocsIndexPage'
import { getDocsForAudienceAndContext } from '@/lib/docs/registry'
import { requireClientDocsAccess } from '@/lib/docs/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { ct } from '@/lib/i18n/clientTranslations'

export async function generateMetadata() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = user ? await resolveClientFromUser(user.id, user.email, service, 'id') : null
  const lang = client ? await resolveClientLanguage(service, client.id) : 'fr'

  return { title: ct(lang, 'profil.docs.workout.meta') }
}

export default async function ClientWorkoutDocumentationIndexPage() {
  await requireClientDocsAccess()
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = user ? await resolveClientFromUser(user.id, user.email, service, 'id') : null
  const lang = client ? await resolveClientLanguage(service, client.id) : 'fr'

  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      <ClientTopBar
        section={ct(lang, 'nav.profil')}
        title={ct(lang, 'profil.docs.workout.meta')}
        backHref="/client/profil"
      />

      <main className="px-4 pb-24 pt-[104px]">
        <DocsIndexPage
          audience="client"
          title={ct(lang, 'profil.docs.workout.indexTitle')}
          intro={ct(lang, 'profil.docs.workout.desc')}
          docs={getDocsForAudienceAndContext('client', 'client-profile-workout')}
        />
      </main>
    </div>
  )
}
