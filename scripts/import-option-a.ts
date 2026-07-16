import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const LIBRARY_PATH = path.join(process.cwd(), 'public/bibliotheque_exercices');

// Muscle group configuration
const MUSCLE_GROUP_CONFIG: Record<string, { csvFile: string; prefix: string }> = {
  'abdos': { csvFile: 'schema-abdo.csv', prefix: 'ABS' },
  'avant-bras': { csvFile: 'schema-avant-bras.csv', prefix: 'FOR' },
  'biceps': { csvFile: 'schema-biceps.csv', prefix: 'BIC' },
  'cardio': { csvFile: 'schema-cardio.csv', prefix: 'CAR' },
  'dos': { csvFile: 'schema-dos.csv', prefix: 'BACK' },
  'epaules': { csvFile: 'schema-epaules.csv', prefix: 'SHOULDER' },
  'fessiers': { csvFile: 'schema-fessiers.csv', prefix: 'GLUTE' },
  'ischio-jambiers': { csvFile: 'schema-ischios.csv', prefix: 'HAM' },
  'mollets': { csvFile: 'schema-mollets.csv', prefix: 'CALF' },
  'pectoraux': { csvFile: 'schema-pectoraux.csv', prefix: 'CHEST' },
  'quadriceps': { csvFile: 'schema-quadriceps.csv', prefix: 'QUAD' },
  'triceps': { csvFile: 'schema-triceps.csv', prefix: 'TRI' },
};

// Allowed taxonomies for validation
const ALLOWED_PRIMARY_MUSCLES = [
  'rectus_abdominis', 'transverse_abdominis', 'lower_abs', 'obliques', 'glutes', 'core_global',
  'wrist_flexors', 'pronators_supinators', 'grip_flexors', 'brachioradialis', 'brachialis', 'biceps_brachii',
  'cardio', 'lats', 'spine_erectors', 'rear_delts', 'traps', 'upper_back', 'trapezius_middle', 'trapezius_lower',
  'anterior_deltoid', 'posterior_deltoid', 'medial_deltoid', 'rotator_cuff', 'subscapularis', 'core',
  'quadriceps', 'upper_traps', 'gluteus_medius', 'gluteus_maximus', 'adductors', 'hamstrings', 'gluteus_minimus',
  'gastrocnemius', 'soleus', 'tibial_anterieur', 'pectoralis_major', 'pectoralis_major_lower', 'pectoralis_major_upper',
  'triceps_brachii'
];

const ALLOWED_SECONDARY_MUSCLES = [
  'hip_flexors', 'obliques', 'lats', 'glutes', 'shoulders', 'hamstrings', 'rectus_abdominis', 'adductors',
  'quadratus_lumborum', 'quads', 'transverse_abdominis', 'spine_erectors', 'core', 'finger_flexors', 'brachioradialis',
  'wrist_stabilizers', 'forearm_flexors', 'traps', 'biceps_brachii', 'brachialis', 'wrist_extensors', 'forearm_extensors',
  'biceps', 'rear_delts', 'rhomboids', 'teres_major', 'triceps', 'levator_scapulae', 'trapezius_lower', 'posterior_deltoid',
  'trapezius_middle', 'medial_deltoid', 'upper_chest', 'upper_traps', 'anterior_deltoid', 'external_rotators',
  'deltoids', 'scapula', 'pec_major', 'gluteus_minimus', 'gluteus_medius', 'quadriceps', 'gluteus_maximus', 'calves',
  'soleus', 'gastrocnemius', 'none', 'anconeus', 'pectoralis_major', 'triceps_brachii', 'flechisseurs_avant_bras',
  'deltoide_anterieur'
];

const ALLOWED_PATTERNS = [
  'core_flexion', 'core_anti_extension', 'core_rotation', 'core_lateral_flexion', 'core_stability', 'core_anti_rotation',
  'wrist_flexion', 'forearm_rotation', 'loaded_carry', 'elbow_flexion', 'pull_vertical', 'pull_horizontal',
  'cardio', 'horizontal_pull', 'vertical_pull', 'spine_extension', 'shoulder_extension', 'scapular_elevation',
  'hip_hinge', 'scapular_retraction', 'scapular_upward_rotation', 'complex_stability', 'vertical_push', 'rear_delt_fly',
  'front_raise', 'lateral_raise', 'rear_delt_pull', 'mobility_stability', 'external_rotation', 'internal_rotation',
  'complex_rotation', 'full_body_push', 'hip_abduction', 'unilateral_lunge', 'core_glute_stability', 'squat_mechanics',
  'unilateral_squat', 'hip_extension', 'squat', 'leg_extension', 'hinge_squat_hybrid', 'unilateral_leg_press',
  'locomotion', 'step_up', 'hinge_mechanics', 'leg_press', 'squat_rotation', 'front_squat', 'squat_jump', 'leg_curl',
  'farmers_walk', 'plantar_flexion', 'dorsiflexion', 'horizontal_push', 'incline_push', 'diagonal_push', 'fly',
  'lateral_squat', 'squat_variation', 'carries', 'isometric_squat', 'elbow_extension'
];

function mapToLocalMuscleGroup(bodyPart: string, muscleGroup: string): string {
  const bp = bodyPart.toLowerCase();
  const mg = muscleGroup.toLowerCase();

  if (bp === 'cardio' || bp === 'cardiovascular system') return 'cardio';
  if (bp === 'waist' || mg === 'abdominals') return 'abdos';
  if (bp === 'lower arms') return 'avant-bras';
  if (bp === 'shoulders' || mg === 'shoulders' || mg === 'deltoids' || mg === 'rotator cuff') return 'epaules';
  if (bp === 'chest' || mg === 'chest') return 'pectoraux';
  
  if (mg === 'biceps') return 'biceps';
  if (mg === 'triceps') return 'triceps';
  
  if (mg === 'glutes') return 'fessiers';
  if (mg === 'hamstrings') return 'ischio-jambiers';
  if (mg === 'quadriceps') return 'quadriceps';
  if (mg === 'calves' || mg === 'soleus') return 'mollets';
  
  if (bp === 'back' || mg === 'lats' || mg === 'latissimus dorsi' || mg === 'traps' || mg === 'trapezius' || mg === 'rhomboids' || mg === 'upper back' || mg === 'lower back') {
    return 'dos';
  }
  
  if (mg.includes('wrist') || mg.includes('forearm') || mg.includes('grip')) return 'avant-bras';

  if (bp === 'upper arms') return 'biceps';
  if (bp === 'upper legs') return 'quadriceps';
  if (bp === 'lower legs') return 'mollets';

  return 'abdos';
}

function getNextId(dir: string, config: { csvFile: string; prefix: string }): string {
  const csvPath = path.join(LIBRARY_PATH, dir, config.csvFile);
  if (!fs.existsSync(csvPath)) {
    return `${config.prefix}-001`;
  }
  const content = fs.readFileSync(csvPath, 'utf-8');
  const regex = new RegExp(`${config.prefix}-(\\d+)`, 'g');
  let max = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const val = parseInt(match[1]);
    if (val > max) max = val;
  }
  const nextNum = max + 1;
  return `${config.prefix}-${nextNum.toString().padStart(3, '0')}`;
}

function appendToCsv(dir: string, config: { csvFile: string; prefix: string }, rowContent: string) {
  const csvPath = path.join(LIBRARY_PATH, dir, config.csvFile);
  let fileContent = fs.readFileSync(csvPath, 'utf-8');
  if (fileContent.length > 0 && !fileContent.endsWith('\n')) {
    fileContent += '\n';
  }
  fileContent += rowContent + '\n';
  fs.writeFileSync(csvPath, fileContent);
}

// Batch translate and enrich exercises using GPT-4o-mini
async function enrichBatch(exercises: any[]) {
  const systemPrompt = `You are a biomechanics and fitness expert. Your job is to translate exercise names to French, English and Spanish, and generate high-fidelity biomechanical metadata for a structured database.
Here are the allowed lists for categories:
Allowed primary muscles: ${JSON.stringify(ALLOWED_PRIMARY_MUSCLES)}
Allowed secondary muscles: ${JSON.stringify(ALLOWED_SECONDARY_MUSCLES)}
Allowed patterns: ${JSON.stringify(ALLOWED_PATTERNS)}

For each exercise in the provided list, return a JSON object with:
1. "original_id": The ID of the exercise in the request.
2. "french_name": A natural, professional French translation of the exercise name (e.g. "Courses à pied", "Extension des mollets", "Burpee").
3. "spanish_name": A natural, professional Spanish translation of the exercise name (e.g. "Sentadillas", "Burpees", "Zancadas").
4. "english_name": A natural, professional English name (usually identical or cleaned up version of the input name).
5. "pattern": Must be one from the Allowed patterns list.
6. "plane": sagittal | frontal | transverse
7. "mechanic": compound | isolation
8. "unilateral": true | false
9. "primary_muscle": Must be one from the Allowed primary muscles list.
10. "primary_activation": A float between 0.3 and 1.0 (representing the contraction intensity).
11. "secondary_muscles": A list of muscles from the Allowed secondary muscles list.
12. "secondary_activations": A list of floats representing activation of each secondary muscle. Must have the same length as secondary_muscles, values usually between 0.05 and 0.3.
13. "stabilizers": A list of muscle stabilizers (e.g. ["core", "shoulders"]).
14. "joint_stress_spine": Integer 1 to 5.
15. "joint_stress_knee": Integer 1 to 5.
16. "joint_stress_shoulder": Integer 1 to 5.
17. "global_instability": Integer 1 to 10.
18. "coordination_demand": Integer 1 to 10.
19. "constraint_profile": A string slug describing the constraints/setup (e.g. "bodyweight_basic", "cable_constant", "machine_stability", "rowing_machine", "free_weight_complex").

Ensure all values strictly belong to the allowed lists.
Return a JSON object in this format:
{
  "exercises": [ ... ]
}`;

  const userPrompt = `Enrich the following exercises:
${JSON.stringify(exercises.map(ex => ({ id: ex.id, name: ex.name, target: ex.target, equipment: ex.equipment, instructions: ex.instructions.en })), null, 2)}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const rawResult = JSON.parse(response.choices[0].message.content || '{}');
  return rawResult.exercises || [];
}

// Backfill database translations for exercises already in the local catalog but missing in DB.
// Uses the French exercise name as exerciseId (lookup key), matching the client page lookup:
//   exerciseDict[set.exercise_name] where exercise_name is the French name stored in logs.
async function runBackfill() {
  console.log('🔄 Running translations backfill for all existing exercises in the catalog...');

  const localCatalog = JSON.parse(fs.readFileSync('data/exercise-catalog.json', 'utf-8'));
  console.log(`Local catalog has ${localCatalog.length} exercises.`);

  // Get all existing translations in Supabase (with pagination to bypass 1000-row limit), keyed by (exerciseId, lang)
  const existing: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await db
      .from('exercise_translations')
      .select('exerciseId, lang')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching existing translations:', error);
      break;
    }
    if (!data || data.length === 0) break;
    existing.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  
  // Build a set keyed by French name (for new-style entries) AND by slug (for legacy UUID-based entries)
  const existingMap = new Set(existing.map(r => `${r.exerciseId}_${r.lang}`));

  // We will download the original dataset to fetch instructions
  console.log('📥 Downloading exercises dataset for instructions...');
  const res = await fetch('https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json');
  const dataset = await res.json();
  const datasetMap = new Map(dataset.map((ex: any) => [ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), ex]));

  const missingTranslations: { frName: string; slug: string; lang: 'FR' | 'EN' | 'ES'; originalEx?: any }[] = [];

  for (const ex of localCatalog) {
    const frName = ex.name; // French name is the lookup key
    const slug = ex.slug;
    const originalEx = datasetMap.get(slug);

    // Check both the new key (French name) and legacy key (slug) to avoid double-inserting
    const hasFR = existingMap.has(`${frName}_FR`) || existingMap.has(`${slug}_FR`);
    const hasEN = existingMap.has(`${frName}_EN`) || existingMap.has(`${slug}_EN`);
    const hasES = existingMap.has(`${frName}_ES`) || existingMap.has(`${slug}_ES`);

    if (!hasFR) missingTranslations.push({ frName, slug, lang: 'FR', originalEx });
    if (!hasEN) missingTranslations.push({ frName, slug, lang: 'EN', originalEx });
    if (!hasES) missingTranslations.push({ frName, slug, lang: 'ES', originalEx });
  }

  console.log(`Found ${missingTranslations.length} missing translations in DB.`);
  if (missingTranslations.length === 0) {
    console.log('✅ Database translations are fully up to date.');
    return;
  }

  // Process missing translations in chunks via OpenAI
  const BATCH_SIZE = 15;
  for (let i = 0; i < missingTranslations.length; i += BATCH_SIZE) {
    const chunk = missingTranslations.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missingTranslations.length / BATCH_SIZE);
    console.log(`Processing translation batch ${batchNum}/${totalBatches} (${chunk.length} items)...`);

    // For FR: name is already the French name. For EN/ES: translate via OpenAI.
    const prompts = chunk.map(item => ({
      fr_name: item.frName,
      target_lang: item.lang,
      // If we have original English instructions, include them for context
      en_hint: item.originalEx?.name || ''
    }));

    let transResults: any[] = [];
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a fitness expert. Translate exercise names.
- For lang=FR: return the French name as-is (it is already French)
- For lang=EN: return a clean English name (use en_hint as reference)
- For lang=ES: translate the French name to natural Spanish fitness terminology
Return JSON: { translations: [{ fr_name, target_lang, translated_name }] }`
          },
          { role: 'user', content: JSON.stringify(prompts) }
        ],
        response_format: { type: 'json_object' }
      });
      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      transResults = parsed.translations || [];
    } catch (err) {
      console.error('OpenAI error in batch:', err);
    }

    const upserts: any[] = [];
    for (const item of chunk) {
      const match = transResults.find((r: any) => r.fr_name === item.frName && r.target_lang === item.lang);
      let name: string;
      if (item.lang === 'FR') {
        name = item.frName; // always use the French name as-is for FR
      } else {
        name = match?.translated_name || item.frName; // fallback to FR name if no translation
      }

      let description = '';
      if (item.originalEx?.instructions) {
        description = item.originalEx.instructions[item.lang.toLowerCase()] || '';
      }

      upserts.push({
        id: crypto.randomUUID(),
        exerciseId: item.frName, // French name as the lookup key
        lang: item.lang,
        name,
        description
      });
    }

    if (upserts.length > 0) {
      const { error } = await db
        .from('exercise_translations')
        .upsert(upserts, { onConflict: 'exerciseId,lang', ignoreDuplicates: true });
      if (error) {
        console.error(`Supabase upsert error (batch ${batchNum}):`, error);
      } else {
        console.log(`  ✅ Batch ${batchNum}: ${upserts.length} translations upserted.`);
      }
    }
  }

  console.log('🎉 Backfill completed!');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--backfill-db')) {
    await runBackfill();
    return;
  }

  const packArg = args.find(arg => arg.startsWith('--pack='))?.split('=')[1] || 'cardio';
  const limitArg = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '5');
  const offsetArg = parseInt(args.find(arg => arg.startsWith('--offset='))?.split('=')[1] || '0');

  console.log(`🚀 Starting Option A import. Pack: ${packArg}, Limit: ${limitArg}, Offset: ${offsetArg}`);

  // Fetch dataset
  const res = await fetch('https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json');
  const dataset = await res.json();

  // Load local catalog to avoid duplicates
  const localCatalog = JSON.parse(fs.readFileSync('data/exercise-catalog.json', 'utf-8'));
  const localSlugs = new Set(localCatalog.map((ex: any) => ex.slug));
  const localNamesNormalized = new Set(
    localCatalog.map((ex: any) => ex.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );

  const cardioRegex = /\b(run|running|jog|jogging|sprint|sprinter|jump\s+rope|jumping\s+jack|burpee|mountain\s+climber|bear\s+crawl|high\s+knees|butt\s+kicks|shadow\s+box|rower|rowing|elliptical|cycling|spinning|biking|shuttle|agility|jumping\s+jacks|jump\s+ropes|skipping\s+rope)\b/i;

  // Filter based on pack selection
  let candidates = dataset.filter((ex: any) => {
    const isCardio = 
      ex.body_part === 'cardiovascular system' || 
      ex.target === 'cardiovascular system' || 
      ex.equipment === 'cardio machine' ||
      cardioRegex.test(ex.name);

    if (packArg === 'cardio') return isCardio;
    if (packArg === 'bodyweight') return ex.equipment === 'body weight' && !isCardio;
    if (packArg === 'kettlebell') return ex.equipment === 'kettlebell';
    if (packArg === 'dumbbell') return ex.equipment === 'dumbbell';
    if (packArg === 'cable') return ex.equipment === 'cable';
    if (packArg === 'band') return ex.equipment === 'band' || ex.equipment === 'resistance band';
    if (packArg === 'ball') return ex.equipment === 'stability ball' || ex.equipment === 'medicine ball';
    return isCardio || ex.equipment === 'body weight';
  });

  // Filter out duplicates
  candidates = candidates.filter((ex: any) => {
    const slug = ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const normName = ex.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return !localSlugs.has(slug) && !localNamesNormalized.has(normName);
  });

  const totalFiltered = candidates.length;
  console.log(`Total missing candidates found: ${totalFiltered}`);

  // Slice based on offset and limit
  const batchToProcess = candidates.slice(offsetArg, offsetArg + limitArg);
  if (batchToProcess.length === 0) {
    console.log('No new exercises to import.');
    return;
  }

  console.log(`Processing batch of ${batchToProcess.length} exercises (Offset: ${offsetArg})...`);

  // Process in chunks of 15 to avoid OpenAI limits
  const chunkSize = 15;
  const enrichedList: any[] = [];
  for (let i = 0; i < batchToProcess.length; i += chunkSize) {
    const chunk = batchToProcess.slice(i, i + chunkSize);
    console.log(`Sending chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} items) to OpenAI...`);
    const results = await enrichBatch(chunk);
    enrichedList.push(...results);
  }

  console.log(`✅ Successfully enriched ${enrichedList.length} exercises from OpenAI.`);

  // Write back to CSV files and insert DB translations
  let importedCount = 0;
  const translationInserts: any[] = [];

  for (const enriched of enrichedList) {
    const original = batchToProcess.find(ex => ex.id === enriched.original_id);
    if (!original) {
      console.warn(`Could not find original exercise for ID ${enriched.original_id}`);
      continue;
    }

    const dir = mapToLocalMuscleGroup(original.body_part, original.muscle_group);
    const config = MUSCLE_GROUP_CONFIG[dir];
    if (!config) {
      console.warn(`No muscle group config found for directory: ${dir}`);
      continue;
    }

    // Double check that primary muscle and pattern are valid, else fallback
    const primaryMuscle = ALLOWED_PRIMARY_MUSCLES.includes(enriched.primary_muscle) 
      ? enriched.primary_muscle 
      : (dir === 'cardio' ? 'cardio' : dir);
    const pattern = ALLOWED_PATTERNS.includes(enriched.pattern) 
      ? enriched.pattern 
      : (dir === 'cardio' ? 'cardio' : 'mobility_stability');

    const nextId = getNextId(dir, config);

    // Format fields
    const escapeCsvField = (val: string) => {
      const str = val?.trim() || '';
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const name = escapeCsvField(enriched.french_name);
    const plane = enriched.plane || 'sagittal';
    const mechanic = enriched.mechanic || 'isolation';
    const unilateral = enriched.unilateral ? 'true' : 'false';
    const primaryActivation = enriched.primary_activation || 0.7;
    const secondaryMusclesStr = (enriched.secondary_muscles || [])
      .filter((m: string) => ALLOWED_SECONDARY_MUSCLES.includes(m))
      .join('|');
    const secondaryActivationsStr = (enriched.secondary_activations || []).join('|');
    const stabilizersStr = (enriched.stabilizers || []).join('|');
    const jointStressSpine = enriched.joint_stress_spine || 1;
    const jointStressKnee = enriched.joint_stress_knee || 1;
    const jointStressShoulder = enriched.joint_stress_shoulder || 1;
    const globalInstability = enriched.global_instability || 1;
    const coordinationDemand = enriched.coordination_demand || 1;
    const constraintProfile = enriched.constraint_profile || 'bodyweight_basic';

    // Construct CSV Row
    const row = [
      nextId,
      name,
      pattern,
      plane,
      mechanic,
      unilateral,
      primaryMuscle,
      primaryActivation,
      secondaryMusclesStr,
      secondaryActivationsStr,
      stabilizersStr,
      jointStressSpine,
      jointStressKnee,
      jointStressShoulder,
      globalInstability,
      coordinationDemand,
      constraintProfile
    ].join(',');

    appendToCsv(dir, config, row);
    console.log(`[Imported] ${nextId} | ${name} -> public/bibliotheque_exercices/${dir}/${config.csvFile}`);
    importedCount++;

    // Add translation records.
    // KEY: exerciseId = French name, which matches the client_set_logs.exercise_name lookup
    // in app/client/programme/page.tsx (exerciseDict[set.exercise_name]).
    // The FK constraint on exercise_translations.exerciseId was dropped in migration
    // 20260717_exercise_translations_drop_fk.sql to allow this pattern.

    // French
    translationInserts.push({
      id: crypto.randomUUID(),
      exerciseId: enriched.french_name,
      lang: 'FR',
      name: enriched.french_name,
      description: original.instructions?.fr || ''
    });

    // Spanish
    translationInserts.push({
      id: crypto.randomUUID(),
      exerciseId: enriched.french_name,
      lang: 'ES',
      name: enriched.spanish_name,
      description: original.instructions?.es || ''
    });

    // English
    translationInserts.push({
      id: crypto.randomUUID(),
      exerciseId: enriched.french_name,
      lang: 'EN',
      name: enriched.english_name,
      description: original.instructions?.en || ''
    });
  }

  // Upsert translation records into database (idempotent)
  if (translationInserts.length > 0) {
    console.log(`Upserting ${translationInserts.length} translation records into Supabase...`);
    const { error } = await db
      .from('exercise_translations')
      .upsert(translationInserts, { onConflict: 'exerciseId,lang', ignoreDuplicates: true });
    if (error) {
      console.error('Supabase translation upsert error:', error);
    } else {
      console.log('✅ Successfully upserted translations in Supabase.');
    }
  }

  console.log(`\n🎉 Import finished! Successfully appended ${importedCount} rows to CSV files.`);
  console.log(`Next step: Run the catalog generation & merge scripts to compile data/exercise-catalog.json.`);
}

main().catch(console.error);
