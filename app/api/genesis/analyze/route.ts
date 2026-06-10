import { createServiceClient } from "@/lib/supabase/client";
import { z } from "zod";
import mapping from "@/app/lib/genesis/mapping/questions_to_axes.json";
import type { MappingFile } from "@/app/lib/genesis/scoring/scoring-engine";
import { computeIPTScore } from "@/app/lib/genesis/scoring/scoring-engine";
import { detectPatterns } from "@/app/lib/genesis/patterns/pattern-detector";
import { generateOutput } from "@/app/lib/genesis/output/output-generator";
import { runQualityChecks } from "@/app/lib/genesis/quality/quality-contract";
import { logQualityEvents } from "@/app/lib/genesis/quality/quality-logger";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BodySchema = z.object({
  mode: z.enum(["ipt", "gplus", "omni"]).default("ipt"),
  answers: z.record(z.any()),
  sessionId: z.string(), // ← NOUVEAU: ID de session
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { mode, answers, sessionId } = parsed.data;

  // --------------------------------------------------
  // 1-4. TA LOGIQUE EXISTANTE (on garde !)
  // --------------------------------------------------
  const typedMapping = mapping as unknown as MappingFile;
  const scoring = computeIPTScore(answers, typedMapping);
  const patterns = detectPatterns(scoring);
  const output = generateOutput({
    mode,
    scoring_version: scoring.scoring_version,
    ipt_global: scoring.ipt_global,
    axes: scoring.axes,
    patterns,
  });

  const requiredIds = typedMapping.questions.map((q) => q.question_id);
  const qualityEvents = runQualityChecks({
    answers,
    required_question_ids: requiredIds,
    ipt_global: scoring.ipt_global,
    axes: scoring.axes,
  });
  logQualityEvents(qualityEvents);

  // --------------------------------------------------
  // 5. NOUVEAU: Sauvegarder dans nouvelle structure
  // --------------------------------------------------
  try {
    // Récupérer session et user
    const { data: session } = await supabase
      .from("ipt_sessions")
      .select("user_id, email")
      .eq("id", sessionId)
      .single();

    if (!session) {
      throw new Error("Session not found");
    }

    // Sauvegarder résultat dans nouvelle table
    const { data: result, error } = await supabase
      .from("ipt_results")
      .insert({
        session_id: sessionId,
        user_id: session.user_id,
        ipt_global: scoring.ipt_global,
        ipt_sleep: scoring.axes.sleep?.normalized ?? 0,
        ipt_nutrition: scoring.axes.nutrition?.normalized ?? 0,
        ipt_stress: scoring.axes.stress?.normalized ?? 0,
        ipt_training: scoring.axes.training?.normalized ?? 0,
        ipt_recovery: scoring.axes.recovery?.normalized ?? 0,
        ipt_adherence: scoring.axes.adherence?.normalized ?? 0,
        root_causes: patterns, // Array JSON
        protocol_recommendation: mode,
        success_probability: scoring.ipt_global, // À affiner
        full_report: {
          scoring,
          patterns,
          output,
          quality: qualityEvents,
        },
        engine_version: scoring.scoring_version,
      })
      .select()
      .single();

    if (error) throw error;

    // --------------------------------------------------
    // 6. Response (avec result_id)
    // --------------------------------------------------
    return Response.json({
      ok: true,
      result_id: result.id, // ← NOUVEAU
      ipt_global: scoring.ipt_global,
      scoring,
      patterns,
      output,
      quality: qualityEvents,
    });
  } catch (error: any) {
    console.error("Erreur sauvegarde résultat:", error);

    // Fallback: sauvegarder dans ancienne table aussi
    await supabase.from("genesis_analyses").insert({
      session_id: sessionId,
      result_data: { scoring, patterns, output },
      ipt_score: scoring.ipt_global,
    });

    return Response.json({
      ok: true,
      warning: "Saved in fallback table",
      ipt_global: scoring.ipt_global,
      scoring,
      patterns,
      output,
      quality: qualityEvents,
    });
  }
}
