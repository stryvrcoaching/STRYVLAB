import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const dryRun = process.argv.includes('--dry-run')
// Smaller batches keep the structured response reliable for long catalogue names.
const batchSize = 50

if (!process.env.OPENAI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing OPENAI_API_KEY or Supabase configuration')
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

async function fetchAll(queryFactory) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

async function translateBatch(items) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0,
    max_completion_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: 'You translate French food catalogue names into natural neutral Spanish for a nutrition tracking app. Preserve brands, quantities, cooking states, punctuation, and scientific qualifiers. Return JSON only: {"translations":[{"id":"...","name":"..."}]}. Return exactly one entry for every input id. Do not add commentary.',
      },
      {
        role: 'user',
        content: JSON.stringify({ items }),
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('Translation model returned no content')
  const parsed = JSON.parse(content)
  const translations = Array.isArray(parsed.translations) ? parsed.translations : []
  const expected = new Set(items.map((item) => item.id))
  if (translations.length !== items.length || translations.some((item) => !expected.has(item.id) || typeof item.name !== 'string' || !item.name.trim())) {
    throw new Error(`Translation response failed validation: expected ${items.length}, received ${translations.length}`)
  }
  return translations.map((item) => ({ food_item_id: item.id, lang: 'es', name: item.name.trim() }))
}

const foods = await fetchAll((from, to) => db.from('food_items').select('id, name_fr').order('name_fr').range(from, to))
const existing = await fetchAll((from, to) => db.from('food_item_translations').select('food_item_id').eq('lang', 'es').range(from, to))

const translatedIds = new Set(existing.map((row) => row.food_item_id))
const missing = foods.filter((food) => !translatedIds.has(food.id))
console.log(JSON.stringify({ dryRun, missing: missing.length, batches: Math.ceil(missing.length / batchSize) }))

if (dryRun || missing.length === 0) process.exit(0)

let completed = 0
for (const batch of chunks(missing, batchSize)) {
  let translations
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      translations = await translateBatch(batch)
      break
    } catch (error) {
      if (attempt === 3) throw error
    }
  }

  const { error } = await db
    .from('food_item_translations')
    .upsert(translations, { onConflict: 'food_item_id,lang' })
  if (error) throw error

  completed += batch.length
  console.log(JSON.stringify({ completed, total: missing.length }))
}
