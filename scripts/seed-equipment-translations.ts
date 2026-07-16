import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import OpenAI from 'openai';

config({ path: '.env.local' });

const BATCH_SIZE = 100;
const TARGET_LANG = { lang: 'ES', instruction: 'Translate the following French equipment names to Spanish. Use standard fitness terminology. Return a JSON array of objects {id, name}.' } as const;

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const { data: frEntries } = await db
    .from('equipment_translations')
    .select('equipmentId, name')
    .eq('lang', 'FR');
  if (!frEntries) {
    console.error('Failed to fetch French equipment entries');
    process.exit(1);
  }

  const { data: existingEs } = await db
    .from('equipment_translations')
    .select('equipmentId')
    .eq('lang', TARGET_LANG.lang);
  const existingIds = new Set((existingEs ?? []).map((t: any) => t.equipmentId));

  const toTranslate = frEntries.filter((e: any) => !existingIds.has(e.equipmentId));
  console.log(`${toTranslate.length} equipment names to translate`);

  let translated = 0;
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const inputJson = JSON.stringify(batch.map((item: any) => ({ id: item.equipmentId, name: item.name })));
    let attempts = 0;
    while (attempts < 3) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            { role: 'system', content: TARGET_LANG.instruction },
            { role: 'user', content: inputJson },
          ],
          response_format: { type: 'json_object' },
        });
        const raw = response.choices[0].message.content ?? '{}';
        const parsed = JSON.parse(raw);
        const results: Array<{ id: string; name: string }> = Array.isArray(parsed)
          ? parsed
          : Object.values(parsed).find((v) => Array.isArray(v)) ?? [];
        const rows = results
          .filter((r) => r.id && r.name)
          .map((r) => ({ id: crypto.randomUUID(), equipmentId: r.id, lang: TARGET_LANG.lang, name: r.name }));
        if (rows.length > 0) {
          const { error } = await db
            .from('equipment_translations')
            .upsert(rows, { onConflict: 'equipmentId,lang', ignoreDuplicates: true });
          if (error) throw error;
        }
        translated += rows.length;
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${rows.length} rows inserted (total: ${translated})`);
        break;
      } catch (err) {
        attempts++;
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${attempts}):`, err);
        if (attempts >= 3) console.error('Skipping batch after 3 failures');
        else await new Promise((r) => setTimeout(r, 2000 * attempts));
      }
    }
  }

  console.log(`ES equipment translations done: ${translated} inserted`);
}

main().catch(console.error);
