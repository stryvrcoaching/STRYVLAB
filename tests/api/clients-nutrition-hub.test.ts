import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMocks } from "../mocks/supabase";

const mocks = createSupabaseMocks();

vi.mock("@/utils/supabase/server", () => ({ createClient: () => mocks.serverMock }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.serviceMock }));
vi.mock("@/lib/nutrition/smoothing/coach-service", () => ({
  buildCoachSmoothingState: vi.fn(async () => ({
    date: new Date().toISOString().slice(0, 10),
    protocolId: "protocol-1",
    protocolName: "Protocole",
    activePlan: null,
    proposal: {
      eligible: false,
      thresholdKcal: 150,
      rawDeltaKcal: 0,
      smoothableDeltaKcal: 0,
      direction: null,
      recommendedDurationDays: null,
    },
    previewDays: [],
  })),
  ensureCoachSmoothingRecommendationNotification: vi.fn(async () => undefined),
}));
vi.mock("@/lib/nutrition/tdee-state", () => ({
  fetchClientTdeeState: vi.fn(async () => ({
    current: null,
    history: [],
  })),
}));

import { GET } from "@/app/api/clients/[clientId]/nutrition-hub/route";
import { NextRequest } from "../mocks/next-server";

beforeEach(() => mocks.resetMocks());

function makeRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

async function json(res: Response) {
  return res.json();
}

describe("GET /api/clients/[clientId]/nutrition-hub", () => {
  it("returns 401 when no user is authenticated", async () => {
    mocks.setServerUser(null);

    const response = await GET(
      makeRequest("http://localhost/api/clients/client-1/nutrition-hub?window=7") as any,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for unsupported windows", async () => {
    const response = await GET(
      makeRequest("http://localhost/api/clients/client-1/nutrition-hub?window=9") as any,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the client does not belong to the coach", async () => {
    mocks.setServiceResults([
      { data: null, error: null },
    ]);

    const response = await GET(
      makeRequest("http://localhost/api/clients/client-1/nutrition-hub?window=7") as any,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns a shaped payload for an owned client", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1", timezone: "Europe/Paris" }, error: null },
      {
        data: {
          schedule_start_date: "2026-05-26",
          nutrition_protocol_days: [
            {
              position: 0,
              name: "Jour entraînement",
              calories: 2200,
              protein_g: 160,
              carbs_g: 220,
              fat_g: 70,
              hydration_ml: 3000,
              carb_cycle_type: "high",
            },
          ],
          nutrition_protocol_schedule_slots: [],
        },
        error: null,
      },
      {
        data: [
          {
            physiological_date: new Date().toISOString().slice(0, 10),
            meal_type: "lunch",
            total_protein_g: 140,
            total_carbs_g: 180,
            total_fat_g: 60,
            total_fiber_g: 20,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            amount_ml: 2100,
            logged_at: new Date().toISOString(),
          },
        ],
        error: null,
      },
      {
        data: [
          {
            calculated_at: new Date().toISOString(),
            tdee_adaptive: 2450,
            tdee_formula: 2360,
            delta_kcal: 90,
            avg_intake_kcal: 2280,
            weight_delta_kg: -0.2,
            weight_samples: 4,
          },
        ],
        error: null,
      },
      {
        data: {
          id: "plan-1",
          client_id: "client-1",
          coach_id: "coach-123",
          source_date: "2026-06-28",
          source_target_kcal: 2200,
          source_consumed_kcal: 2500,
          threshold_kcal: 50,
          raw_delta_kcal: 300,
          smoothable_delta_kcal: 250,
          direction: "surplus",
          duration_days: 3,
          strategy: "recommended",
          status: "active",
          created_by: "client",
          client_decision: "confirmed",
          replaced_by_plan_id: null,
          coach_note: "On garde ça court.",
          coach_note_updated_at: new Date().toISOString(),
          coach_last_action: "noted",
          nutrition_smoothing_plan_days: [
            {
              id: "day-1",
              plan_id: "plan-1",
              date: new Date().toISOString().slice(0, 10),
              sequence_index: 0,
              resolved_bucket: "neutral_day",
              source_day_label: "Jour",
              day_weight: 1,
              base_target_kcal: 2200,
              cycle_synced_target_kcal: 2200,
              kcal_delta: -80,
              protein_delta_g: 0,
              carbs_delta_g: -20,
              fat_delta_g: 0,
              status: "pending",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
        error: null,
      },
    ]);

    const response = await GET(
      makeRequest("http://localhost/api/clients/client-1/nutrition-hub?window=7") as any,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );

    expect(response.status).toBe(200);

    const body = await json(response);
    expect(body.summary).toBeDefined();
    expect(body.trend.window).toBe(7);
    expect(body.agenda).toBeInstanceOf(Array);
    expect(body.energy).toBeDefined();
    expect(body.availableWindows).toEqual([3, 7, 14, 30]);
    expect(body.activeSmoothingPlan?.id).toBe("plan-1");
  }, 15000);
});
