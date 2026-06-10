/**
 * Hydrate primary_muscles_normalized and secondary_muscles_normalized
 * from exercise-catalog.json (EN legacy) → FR canonical muscles
 *
 * Usage: npx tsx scripts/hydrate-normalized-muscles.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

// EN → FR canonical muscle mapping
const EN_TO_CANONICAL: Record<string, string> = {
  // Chest
  pectoralis_major: "grand_pectoral",
  pectoralis_minor: "petit_pectoral",

  // Back
  latissimus_dorsi: "grand_dorsal",
  trapezius: "trapeze_superieur",
  trapezius_upper: "trapeze_superieur",
  trapezius_middle: "trapeze_moyen",
  trapezius_lower: "trapeze_inferieur",
  rhomboid: "rhomboides",
  erector_spinae: "erecteurs_spinaux",

  // Shoulders
  deltoid_anterior: "deltoide_anterieur",
  deltoid_lateral: "deltoide_lateral",
  deltoid_posterior: "deltoide_posterieur",

  // Arms
  biceps: "biceps",
  biceps_brachii: "biceps_brachial",
  brachialis: "brachial",
  triceps: "triceps",
  triceps_lateral: "triceps_lateral",
  triceps_medial: "triceps_medial",
  triceps_long: "triceps_long",

  // Forearms
  forearm_flexors: "flechisseurs_avant_bras",
  forearm_extensors: "extenseurs_avant_bras",

  // Legs
  quadriceps: "quadriceps",
  rectus_femoris: "rectus_femoris",
  vastus_lateralis: "vaste_lateral",
  vastus_medialis: "vaste_medial",
  vastus_intermedius: "vaste_intermediaire",

  hamstring: "ischio_jambiers",
  biceps_femoris: "biceps_femoral",
  semitendinosus: "semi_tendineux",
  semimembranosus: "semi_membraneux",

  gluteus_maximus: "grand_fessier",
  gluteus_medius: "moyen_fessier",
  gluteus_minimus: "petit_fessier",

  adductor: "adducteurs",
  abductor: "abducteurs",

  calf: "mollet",
  soleus: "solea",
  gastrocnemius: "gastrocnemien",
  tibialis_anterior: "tibial_anterieur",

  // Core
  rectus_abdominis: "abdos",
  abdominal: "abdos",
  oblique_external: "obliques_externes",
  oblique_internal: "obliques_internes",
  transverse_abdominis: "transverse_abdominal",

  // Hip
  hip_flexors: "flechisseurs_hanche",
};

interface CatalogExercise {
  slug: string;
  name: string;
  primaryMuscle?: string | null;
  secondaryMuscles?: string[];
}

async function main() {
  try {
    console.log("📖 Reading exercise-catalog.json...");
    const catalogPath = path.join(__dirname, "../data/exercise-catalog.json");
    const catalogJson = JSON.parse(
      fs.readFileSync(catalogPath, "utf-8"),
    ) as CatalogExercise[];

    console.log(`✅ Loaded ${catalogJson.length} exercises`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const exercise of catalogJson) {
      try {
        // Map primary muscle
        const primaryMuscles: string[] = [];
        if (exercise.primaryMuscle) {
          const fr = EN_TO_CANONICAL[exercise.primaryMuscle];
          if (fr) primaryMuscles.push(fr);
        }

        // Map secondary muscles
        const secondaryMuscles: string[] = [];
        if (
          exercise.secondaryMuscles &&
          Array.isArray(exercise.secondaryMuscles)
        ) {
          for (const en of exercise.secondaryMuscles) {
            const fr = EN_TO_CANONICAL[en];
            if (fr) secondaryMuscles.push(fr);
          }
        }

        // Skip if no muscles mapped
        if (primaryMuscles.length === 0 && secondaryMuscles.length === 0) {
          console.log(`⊘ ${exercise.slug}: no muscles mapped, skipping`);
          skipped++;
          continue;
        }

        // Update in all relevant tables
        const tables = [
          "coach_program_template_exercises",
          "program_exercises",
          "coach_custom_exercises",
        ];

        for (const table of tables) {
          const { error } = await client
            .from(table)
            .update({
              primary_muscles_normalized: primaryMuscles,
              secondary_muscles_normalized: secondaryMuscles,
            })
            .eq("name", exercise.name);

          if (error && error.code !== "PGRST116") {
            // PGRST116 = no rows updated (OK for custom/template tables if exercise not used)
            console.warn(`⚠️ ${exercise.slug} (${table}): ${error.message}`);
          }
        }

        updated++;
        if (updated % 50 === 0)
          console.log(`✓ ${updated} exercises processed...`);
      } catch (err) {
        console.error(`❌ ${exercise.slug}:`, err);
        failed++;
      }
    }

    console.log(`\n✅ Hydration complete:`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Failed: ${failed}`);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
