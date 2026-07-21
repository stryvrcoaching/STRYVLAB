import { NextResponse } from 'next/server'
import { createServiceDb, requireAuthedUser, resolveClientForUser } from '@/lib/training/flexTraining/server'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

export async function GET() {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const db = createServiceDb()
  const { data: preferences } = await db
    .from('client_preferences')
    .select('language')
    .eq('client_id', client.id)
    .maybeSingle()
  const lang: ClientLang = preferences?.language === 'es' || preferences?.language === 'en' ? preferences.language : 'fr'
  const { data } = await db
    .from('exercise_translations')
    .select('exerciseId, name')
    .eq('lang', lang.toUpperCase())

  // Return only display data. The local catalogue keeps IDs and metadata.
  const translations = Object.fromEntries(
    (data ?? [])
      .filter((row: { exerciseId?: string; name?: string }) => row.exerciseId?.trim() && row.name?.trim())
      .map((row: { exerciseId: string; name: string }) => [row.exerciseId, row.name]),
  )
  return NextResponse.json({ lang, translations })
}
