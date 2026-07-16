import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

export const DEFAULT_CLIENT_LANG: ClientLang = 'fr'

export function normalizeClientLang(value: string | null | undefined): ClientLang {
  if (value === 'es' || value === 'en' || value === 'fr') return value
  return DEFAULT_CLIENT_LANG
}

export async function resolveClientLanguage(
  db: SupabaseClient,
  clientId: string,
  fallback?: string | null,
): Promise<ClientLang> {
  // client_preferences is the canonical runtime source. Do not require optional
  // profile columns here: older production schemas may not have them yet.
  const { data: prefs } = await db
    .from('client_preferences')
    .select('language')
    .eq('client_id', clientId)
    .maybeSingle()

  return normalizeClientLang(
    (prefs as { language?: string | null } | null)?.language ?? fallback,
  )
}
