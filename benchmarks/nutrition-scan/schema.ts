import { z } from "zod"

export const benchmarkScenarioSchema = z.enum([
  "simple_plate",
  "complex_plate",
  "separate_weighing",
  "packaging",
  "receipt",
  "hybrid",
  "leftovers",
  "unclassified",
])

export const benchmarkSplitSchema = z.enum(["development", "holdout"])
export const benchmarkTruthTierSchema = z.enum(["A", "B", "C"])

const nutrientTotalsSchema = z.object({
  kcal: z.number().nonnegative().nullable(),
  protein_g: z.number().nonnegative().nullable(),
  carbs_g: z.number().nonnegative().nullable(),
  fat_g: z.number().nonnegative().nullable(),
  fiber_g: z.number().nonnegative().nullable(),
})

export const benchmarkTruthComponentSchema = z.object({
  name_fr: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  quantity_g: z.number().positive().nullable(),
  nutrients: nutrientTotalsSchema,
})

export const benchmarkTruthSchema = z.object({
  tier: benchmarkTruthTierSchema,
  analysis_mode: z.enum(["plate", "packaging", "barcode", "receipt", "hybrid"]),
  components: z.array(benchmarkTruthComponentSchema).min(1),
  totals: nutrientTotalsSchema.nullable(),
  annotation_method: z.string().trim().min(1),
  reviewed_by: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().trim().nullable().default(null),
})

export const benchmarkPhotoSchema = z.object({
  path: z.string().trim().min(1),
  kind: z.enum(["context", "top", "side", "scale_zoom", "leftovers"]).default("context"),
  role_hint: z.enum([
    "before_meal",
    "after_meal_leftovers",
    "separate_weighing",
    "receipt",
    "packaging_front",
    "nutrition_label",
    "barcode",
    "detail",
    "unknown",
  ]).nullable().default(null),
})

export const benchmarkCaseSchema = z.object({
  schema_version: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().trim().min(1),
  status: z.enum(["ready", "needs_truth", "excluded"]),
  split: benchmarkSplitSchema,
  scenario: benchmarkScenarioSchema,
  provenance: z.object({
    source_type: z.enum(["owned", "licensed_dataset", "official_public", "synthetic"]),
    source_url: z.string().url().nullable(),
    license: z.string().trim().min(1),
    attribution: z.string().trim().nullable(),
    consent_confirmed: z.boolean(),
    notes: z.string().trim().nullable().default(null),
  }),
  input: z.object({
    photos: z.array(benchmarkPhotoSchema).min(1).max(20),
    text: z.string().trim().nullable().default(null),
    manual_weight_g: z.number().positive().nullable().default(null),
    clarification_answers: z.record(z.string()).default({}),
  }),
  truth: benchmarkTruthSchema.nullable(),
}).superRefine((benchmarkCase, context) => {
  if (benchmarkCase.status === "ready" && !benchmarkCase.truth) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["truth"],
      message: "Un cas ready doit contenir une vérité terrain.",
    })
  }

  if (benchmarkCase.provenance.source_type === "owned" && !benchmarkCase.provenance.consent_confirmed) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provenance", "consent_confirmed"],
      message: "Les contenus privés doivent être possédés ou utilisés avec consentement.",
    })
  }
})

export type BenchmarkCase = z.infer<typeof benchmarkCaseSchema>
export type BenchmarkScenario = z.infer<typeof benchmarkScenarioSchema>
export type BenchmarkTruth = z.infer<typeof benchmarkTruthSchema>
export type BenchmarkTruthComponent = z.infer<typeof benchmarkTruthComponentSchema>
