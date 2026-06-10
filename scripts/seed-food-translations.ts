import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

config({ path: '.env.local' })

const BATCH_SIZE = 100
const TARGET_LANGS: Array<{ lang: 'es' | 'en'; instruction: string }> = [
  {
    lang: 'es',
    instruction: 'Translate the following French food names to Spanish. Use standard culinary/food Spanish terminology (not literal translation). Return a JSON array of objects {id, name}.',
  },
  {
    lang: 'en',
    instruction: 'Translate the following French food names to English. Use standard culinary/food English terminology. Return a JSON array of objects {id, name}.',
  },
]

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  // Translate to ES and EN
  for (const { lang, instruction } of TARGET_LANGS) {
    console.log(`\n=== Translating to ${lang.toUpperCase()} ===`)

    // Get all food items
    const { data: allItems } = await db.from('food_items').select('id, name_fr').order('name_fr')
    if (!allItems) { console.error('Failed to fetch food items'); process.exit(1) }

    // Get items already translated to this lang
    const { data: existingTranslations } = await db
      .from('food_item_translations')
      .select('food_item_id')
      .eq('lang', lang)
    const existingIds = new Set((existingTranslations ?? []).map(t => t.food_item_id))
    const toTranslate = allItems.filter(item => !existingIds.has(item.id))

    console.log(`${toTranslate.length} items to translate (${allItems.length - toTranslate.length} already done)`)

    let translated = 0
    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE)
      const inputJson = JSON.stringify(batch.map(item => ({ id: item.id, name: item.name_fr })))

      let attempts = 0
      while (attempts < 3) {
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0,
            messages: [
              { role: 'system', content: instruction },
              { role: 'user', content: inputJson },
            ],
            response_format: { type: 'json_object' },
          })

          const raw = response.choices[0].message.content ?? '{}'
          const parsed = JSON.parse(raw)
          const results: Array<{ id: string; name: string }> =
            Array.isArray(parsed) ? parsed : Object.values(parsed).find(v => Array.isArray(v)) as any ?? []

          const rows = results
            .filter(r => r.id && r.name)
            .map(r => ({ food_item_id: r.id, lang, name: r.name }))

          if (rows.length > 0) {
            const { error } = await db
              .from('food_item_translations')
              .upsert(rows, { onConflict: 'food_item_id,lang', ignoreDuplicates: true })
            if (error) throw error
          }

          translated += rows.length
          console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${rows.length} rows inserted (total: ${translated})`)
          break
        } catch (err) {
          attempts++
          console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${attempts}):`, err)
          if (attempts >= 3) console.error('  Skipping batch after 3 failures')
          else await new Promise(r => setTimeout(r, 2000 * attempts))
        }
      }
    }

    console.log(`${lang.toUpperCase()} done: ${translated} translations inserted`)
  }
}

main().catch(console.error)
