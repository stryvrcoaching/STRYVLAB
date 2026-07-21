import ClientTopBar from '@/components/client/ClientTopBar'
import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
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

  return { title: ct(lang, 'profil.docs.workout.progression.meta') }
}

export default async function ClientWorkoutProgressionDocumentationPage() {
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
    <div className="min-h-dvh bg-[#121212] font-barlow overflow-x-hidden">
      <ClientTopBar
        title={ct(lang, 'profil.docs.workout.meta')}
        backHref="/client/profil/documentation/workout"
      />

      <main className="client-page-top px-4 pb-24">
        <DocsArticle
          eyebrow={ct(lang, 'profil.docs.workout.progression.eyebrow')}
          title={ct(lang, 'profil.docs.workout.progression.title')}
          intro={ct(lang, 'profil.docs.workout.progression.intro')}
          backHref="/client/profil/documentation/workout"
          backLabel={ct(lang, 'profil.docs.workout.meta')}
        >
          <DocsSection title={ct(lang, 'profil.docs.workout.progression.s1.title')}>
            <p>{ct(lang, 'profil.docs.workout.progression.s1.p1')}</p>
            <p>{ct(lang, 'profil.docs.workout.progression.s1.p2')}</p>
          </DocsSection>

          <DocsSection title={ct(lang, 'profil.docs.workout.progression.s2.title')}>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.repsLabel')}>
                <p>{ct(lang, 'profil.docs.workout.progression.reps')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'recap.perEx.weight')}>
                <p>{ct(lang, 'profil.docs.workout.progression.load')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.rirLabel')}>
                <p>{ct(lang, 'profil.docs.workout.progression.rir')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.tempoLabel')}>
                <p>{ct(lang, 'profil.docs.workout.progression.tempo')}</p>
              </DocsCard>
            </div>
          </DocsSection>

          <DocsSection title={ct(lang, 'profil.docs.workout.progression.s3.title')}>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.easyTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.easyBody')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.okTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.okBody')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.hardTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.hardBody')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.manualTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.manualBody')}</p>
              </DocsCard>
            </div>
          </DocsSection>

          <DocsSection title={ct(lang, 'profil.docs.workout.progression.s4.title')}>
            <p>{ct(lang, 'profil.docs.workout.progression.s4.p1')}</p>
            <p>{ct(lang, 'profil.docs.workout.progression.s4.p2')}</p>
          </DocsSection>

          <DocsSection title={ct(lang, 'profil.docs.workout.progression.s5.title')}>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.repsTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.repsBody')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.rirTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.rirBody2')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.tempoTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.tempoBody2')}</p>
              </DocsCard>
              <DocsCard title={ct(lang, 'profil.docs.workout.progression.loadTitle')}>
                <p>{ct(lang, 'profil.docs.workout.progression.loadBody2')}</p>
              </DocsCard>
            </div>
          </DocsSection>
        </DocsArticle>
      </main>
    </div>
  )
}
