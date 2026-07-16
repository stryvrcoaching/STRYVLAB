import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import OpenAI from 'openai';
import fs from 'fs';

config({ path: '.env.local' });

const BATCH_SIZE = 50;
const TARGET_LANG = { lang: 'ES', instruction: 'Translate the following French exercise names to Spanish. Use standard fitness terminology. Return a JSON array of objects {id, name}. Do not include markdown code block syntax in your response.' } as const;

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Read catalog
  const catalogStr = fs.readFileSync('data/exercise-catalog.json', 'utf-8');
  const catalog = JSON.parse(catalogStr);

  const exercises = catalog.map((e: any) => ({
    id: e.slug,
    name: e.name
  }));

  // Existing ES translations
  const { data: existingTrans } = await db
    .from('exercise_translations')
    .select('exerciseId')
    .eq('lang', TARGET_LANG.lang);
  const existingIds = new Set((existingTrans ?? []).map((t: any) => t.exerciseId));

  const toTranslate = exercises.filter((e: any) => !existingIds.has(e.id));
  console.log(`${toTranslate.length} exercise names to translate`);

  let translated = 0;
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const inputJson = JSON.stringify(batch.map((item: any) => ({ id: item.id, name: item.name })));
    let attempts = 0;
    while (attempts < 3) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: TARGET_LANG.instruction },
            { role: 'user', content: inputJson }
          ]
        });
        const content = completion.choices[0].message.content || '[]';
        const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));
        
        const inserts = parsed.map((item: any) => ({
          id: crypto.randomUUID(),
          exerciseId: item.id,
          lang: TARGET_LANG.lang,
          name: item.name
        }));

        const { error } = await db.from('exercise_translations').insert(inserts);
        if (error) {
          console.error('Insert error:', error);
          attempts++;
          continue;
        }
        
        translated += inserts.length;
        console.log(`Translated ${translated}/${toTranslate.length}`);
        break;
      } catch (err) {
        console.error('Error during translation:', err);
        attempts++;
      }
    }
  }
  console.log('Done!');
}

main().catch(console.error);
