// ============================================================
// app/api/calculator-results/query/route.ts
// Query and export calculator results
// GET /api/calculator-results/query
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientCalculatorResults } from "@/lib/db/calculator-results";

export const dynamic = "force-dynamic";

/**
 * Query parameters schema
 */
const querySchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  calculatorType: z
    .enum(["oneRM", "hrZones", "macros", "bodyFat", "water", "karvonen", "bmi"])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Query calculator results
 *
 * Example:
 * GET /api/calculator-results/query?clientId=xxx&calculatorType=oneRM&format=json&limit=50
 */
export async function GET(req: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams);

    const validation = querySchema.safeParse(queryParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      clientId,
      calculatorType,
      startDate,
      endDate,
      format,
      limit,
      offset,
    } = validation.data;

    // Fetch results from database
    const results = await getClientCalculatorResults(
      clientId,
      calculatorType,
      startDate,
      endDate,
      limit,
      offset,
    );

    // Format response
    if (format === "csv") {
      return formatAsCSV(results);
    }

    return NextResponse.json(
      {
        success: true,
        count: results.length,
        clientId,
        calculatorType,
        dateRange: startDate && endDate ? { startDate, endDate } : null,
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/calculator-results/query:", error);

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
 * Format results as CSV
 */
function formatAsCSV(results: any[]): Response {
  const headers = [
    "Date",
    "Calculator Type",
    "Formula Version",
    "Input",
    "Output",
    "Confidence",
  ];

  const rows = results.map((r) => {
    const confidence = r.output?.confidence?.percentageRange
      ? `±${r.output.confidence.percentageRange}%`
      : "N/A";

    return [
      new Date(r.createdAt).toISOString(),
      r.calculatorType,
      r.formulaVersion || "v1.0",
      JSON.stringify(r.input),
      JSON.stringify(r.output),
      confidence,
    ];
  });

  // Escape CSV values with quotes
  const escapedRows = rows.map((row) =>
    row.map((cell) => {
      const cellStr = String(cell);
      if (
        cellStr.includes(",") ||
        cellStr.includes('"') ||
        cellStr.includes("\n")
      ) {
        return `"${cellStr.replace(/"/g, '""')}"`; // Escape quotes by doubling
      }
      return cellStr;
    }),
  );

  const csv = [headers, ...escapedRows].map((row) => row.join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calculator-results-${
        new Date().toISOString().split("T")[0]
      }.csv"`,
    },
  });
}
