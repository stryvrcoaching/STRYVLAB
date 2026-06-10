/**
 * One-time idempotent remap of daily_checkin_configs.moments[].fields to canonical keys.
 * Run: npx tsx scripts/migrate-checkin-config-fields.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { createClient } from '@supabase/supabase-js'
import { canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'

type Moment = { moment: 'morning' | 'evening'; fields: string[] }

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await db.from('daily_checkin_configs').select('client_id, moments')
  if (error) throw new Error(error.message)

  let updated = 0
  for (const row of (data ?? []) as Array<{ client_id: string; moments: Moment[] | null }>) {
    const moments = row.moments ?? []
    const next = moments.map((m) => ({ ...m, fields: canonicalizeFields(m.fields ?? []) }))
    const changed = JSON.stringify(next) !== JSON.stringify(moments)
    if (!changed) continue
    const { error: upErr } = await db
      .from('daily_checkin_configs')
      .update({ moments: next })
      .eq('client_id', row.client_id)
    if (upErr) throw new Error(`update ${row.client_id}: ${upErr.message}`)
    updated++
  }
  console.log(`Remapped ${updated} config row(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
