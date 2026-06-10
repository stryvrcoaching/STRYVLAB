// ============================================================
// app/api/calculator-results/store/route.ts
// Store calculator results in database
// POST /api/calculator-results/store
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { storeCalculatorResult } from "@/lib/db/calculator-results";

/**
 * Request body schema for storing calculator results
 */
const storeResultSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  calculatorType: z.enum([
    "oneRM",
    "hrZones",
    "macros",
    "bodyFat",
    "water",
    "karvonen",
    "bmi",
  ]),
  input: z.record(z.any(), {
    description: "Input parameters used for calculation",
  }),
  output: z.record(z.any(), { description: "Calculation result" }),
  formulaVersion: z.string().default("v1.0"),
  metadata: z.record(z.any()).optional(),
});

/**
 * Store calculator result
 *
 * Example request:
 * POST /api/calculator-results/store
 * {
 *   "clientId": "123e4567-e89b-12d3-a456-426614174000",
 *   "calculatorType": "oneRM",
 *   "input": { "weight": 100, "reps": 5 },
 *   "output": { "oneRM": 113.6, "zones": [...], "formula": "Brzycki" },
 *   "formulaVersion": "v1.0"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validation = storeResultSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      clientId,
      calculatorType,
      input,
      output,
      formulaVersion,
      metadata,
    } = validation.data;

    // Store in database
    const result = await storeCalculatorResult(
      clientId,
      calculatorType,
      input,
      output,
      formulaVersion,
      metadata,
    );

    if (!result) {
      return NextResponse.json(
        { error: "Failed to store calculator result" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/calculator-results/store:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      message: "Calculator results storage API is running",
    },
    { status: 200 },
  );
}
