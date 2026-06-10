// ============================================================
// lib/db/calculator-results.ts
// Service layer for persisting calculator results to DB
// Handles CRUD operations on calculator_results table
// ============================================================

import { createClient } from "@/lib/supabase/client";
import type { CalculatorResultRecord } from "@/types/calculator";

/**
 * Store a calculator result in the database
 */
export async function storeCalculatorResult(
  clientId: string,
  calculatorType: string,
  input: Record<string, any>,
  output: Record<string, any>,
  formulaVersion: string,
  metadata?: Record<string, any>,
): Promise<CalculatorResultRecord | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("calculator_results")
      .insert({
        client_id: clientId,
        calculator_type: calculatorType,
        input,
        output,
        formula_version: formulaVersion,
        metadata: metadata || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store calculator result: ${error.message}`);
    }

    return {
      id: data.id,
      clientId: data.client_id,
      calculatorType: data.calculator_type,
      input: data.input,
      output: data.output,
      formulaVersion: data.formula_version,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("Error storing calculator result:", error);
    return null;
  }
}

/**
 * Get all calculator results for a client
 */
export async function getClientCalculatorResults(
  clientId: string,
  calculatorType?: string,
  startDate?: string,
  endDate?: string,
  limit: number = 100,
  offset: number = 0,
): Promise<CalculatorResultRecord[]> {
  try {
    const supabase = createClient();

    let query = supabase
      .from("calculator_results")
      .select("*")
      .eq("client_id", clientId);

    if (calculatorType) {
      query = query.eq("calculator_type", calculatorType);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch calculator results: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      calculatorType: row.calculator_type,
      input: row.input,
      output: row.output,
      formulaVersion: row.formula_version,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error("Error fetching calculator results:", error);
    return [];
  }
}

/**
 * Get latest result for a specific calculator type
 */
export async function getLatestCalculatorResult(
  clientId: string,
  calculatorType: string,
): Promise<CalculatorResultRecord | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("calculator_results")
      .select("*")
      .eq("client_id", clientId)
      .eq("calculator_type", calculatorType)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (expected)
      throw new Error(
        `Failed to fetch latest calculator result: ${error.message}`,
      );
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      clientId: data.client_id,
      calculatorType: data.calculator_type,
      input: data.input,
      output: data.output,
      formulaVersion: data.formula_version,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("Error fetching latest calculator result:", error);
    return null;
  }
}

/**
 * Get aggregated statistics for a calculator type
 */
export async function getCalculatorStatistics(
  clientId: string,
  calculatorType: string,
): Promise<{
  count: number;
  latest: CalculatorResultRecord | null;
  oldest: CalculatorResultRecord | null;
  average?: number;
} | null> {
  try {
    const supabase = createClient();

    const { data, error, count } = await supabase
      .from("calculator_results")
      .select("*", { count: "exact" })
      .eq("client_id", clientId)
      .eq("calculator_type", calculatorType);

    if (error) {
      throw new Error(
        `Failed to fetch calculator statistics: ${error.message}`,
      );
    }

    if (!data || data.length === 0) {
      return {
        count: 0,
        latest: null,
        oldest: null,
      };
    }

    // Sort by date
    const sorted = data.sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return {
      count: count || 0,
      latest: {
        id: sorted[sorted.length - 1].id,
        clientId: sorted[sorted.length - 1].client_id,
        calculatorType: sorted[sorted.length - 1].calculator_type,
        input: sorted[sorted.length - 1].input,
        output: sorted[sorted.length - 1].output,
        formulaVersion: sorted[sorted.length - 1].formula_version,
        metadata: sorted[sorted.length - 1].metadata,
        createdAt: sorted[sorted.length - 1].created_at,
        updatedAt: sorted[sorted.length - 1].updated_at,
      },
      oldest: {
        id: sorted[0].id,
        clientId: sorted[0].client_id,
        calculatorType: sorted[0].calculator_type,
        input: sorted[0].input,
        output: sorted[0].output,
        formulaVersion: sorted[0].formula_version,
        metadata: sorted[0].metadata,
        createdAt: sorted[0].created_at,
        updatedAt: sorted[0].updated_at,
      },
    };
  } catch (error) {
    console.error("Error fetching calculator statistics:", error);
    return null;
  }
}

/**
 * Delete calculator result
 */
export async function deleteCalculatorResult(
  resultId: string,
): Promise<boolean> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("calculator_results")
      .delete()
      .eq("id", resultId);

    if (error) {
      throw new Error(`Failed to delete calculator result: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error("Error deleting calculator result:", error);
    return false;
  }
}

/**
 * Update calculator result
 */
export async function updateCalculatorResult(
  resultId: string,
  updates: Partial<
    Omit<CalculatorResultRecord, "id" | "clientId" | "createdAt">
  >,
): Promise<CalculatorResultRecord | null> {
  try {
    const supabase = createClient();

    const updateData: any = {};

    if (updates.output) updateData.output = updates.output;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    if (updates.formulaVersion)
      updateData.formula_version = updates.formulaVersion;

    const { data, error } = await supabase
      .from("calculator_results")
      .update(updateData)
      .eq("id", resultId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update calculator result: ${error.message}`);
    }

    return {
      id: data.id,
      clientId: data.client_id,
      calculatorType: data.calculator_type,
      input: data.input,
      output: data.output,
      formulaVersion: data.formula_version,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("Error updating calculator result:", error);
    return null;
  }
}
