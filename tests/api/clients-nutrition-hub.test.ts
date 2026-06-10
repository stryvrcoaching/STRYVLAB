import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMocks } from "../mocks/supabase";

const mocks = createSupabaseMocks();

vi.mock("@/utils/supabase/server", () => ({ createClient: () => mocks.serverMock }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.serviceMock }));

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
    expect(body.availableWindows).toEqual([3, 7, 14, 30]);
  });
});
