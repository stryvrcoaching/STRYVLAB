import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMocks } from "../mocks/supabase"
import { NextRequest, NextResponse } from "../mocks/next-server"

const mocks = createSupabaseMocks()

vi.mock("next/server", () => ({ NextRequest, NextResponse }))
vi.mock("@/utils/supabase/server", () => ({ createClient: () => mocks.serverMock }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.serviceMock }))
vi.mock("@/lib/nutrition/protocolAnnotations", () => ({
  upsertProtocolUpdatedAnnotation: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/assignments/clientAssignments", () => ({
  closeNutritionProtocolAssignment: vi.fn().mockResolvedValue(undefined),
}))

import { PATCH } from "@/app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route"

beforeEach(() => mocks.resetMocks())

function makePatch(body: unknown) {
  return new NextRequest("http://localhost/api/clients/client-1/nutrition-protocols/protocol-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function json(res: Response) {
  return res.json()
}

describe("PATCH /api/clients/[clientId]/nutrition-protocols/[protocolId]", () => {
  it("updates existing days, inserts new days, and deletes removed days without replacing everything", async () => {
    const protocolId = "11111111-1111-4111-8111-111111111111"
    const day1Id = "22222222-2222-4222-8222-222222222222"
    const day2Id = "33333333-3333-4333-8333-333333333333"
    const existingProtocol = {
      id: protocolId,
      client_id: "client-1",
      status: "draft",
      name: "Protocol",
      days: [
        { id: day1Id, position: 0, name: "Jour entraînement" },
        { id: day2Id, position: 1, name: "Jour repos" },
      ],
      schedule_slots: [],
    }

    const updatedProtocol = {
      ...existingProtocol,
      days: [
        { id: day1Id, position: 0, name: "Jour entraînement" },
        { id: "44444444-4444-4444-8444-444444444444", position: 1, name: "Jour repos bis" },
      ],
      schedule_slots: [],
    }

    mocks.setServiceResults([
      { data: { id: "client-1" } },
      { data: existingProtocol },
      { data: null },
      { data: null },
      { data: null },
      { data: { id: "client-1" } },
      { data: updatedProtocol },
    ])

    const res = await PATCH(makePatch({
      days: [
        {
          id: day1Id,
          name: "Jour entraînement",
          position: 0,
          calories: 1704,
          protein_g: 150,
          carbs_g: 160,
          fat_g: 55,
          hydration_ml: 2500,
          role: "training",
          carb_cycle_type: "high",
          cycle_sync_phase: null,
          recommendations: null,
          meal_plan: [],
        },
        {
          name: "Jour repos bis",
          position: 1,
          calories: 1600,
          protein_g: 150,
          carbs_g: 120,
          fat_g: 60,
          hydration_ml: 2500,
          role: "rest",
          carb_cycle_type: "low",
          cycle_sync_phase: null,
          recommendations: null,
          meal_plan: [],
        },
      ],
    }), { params: Promise.resolve({ clientId: "client-1", protocolId }) })

    expect(res.status).toBe(200)

    const builders = mocks.serviceMock.from.mock.results.map((call) => call.value)
    expect(builders[2].update).toHaveBeenCalled()
    expect(builders[3].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol_id: protocolId,
        name: "Jour repos bis",
        position: 1,
      }),
    )
    expect(builders[4].delete).toHaveBeenCalled()

    const body = await json(res)
    expect(body.protocol.days).toHaveLength(2)
  })

  it("returns 500 and does not proceed to sharing reads when a day insert fails", async () => {
    const protocolId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const existingProtocol = {
      id: protocolId,
      client_id: "client-1",
      status: "draft",
      name: "Protocol",
      days: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", position: 0, name: "Jour entraînement" }],
      schedule_slots: [],
    }

    mocks.setServiceResults([
      { data: { id: "client-1" } },
      { data: existingProtocol },
      { data: null, error: { message: "insert failed" } },
    ])

    const res = await PATCH(makePatch({
      days: [
        {
          name: "Jour repos",
          position: 0,
          calories: 1600,
          protein_g: 140,
          carbs_g: 120,
          fat_g: 55,
          hydration_ml: 2500,
          role: "rest",
          carb_cycle_type: "low",
          cycle_sync_phase: null,
          recommendations: null,
          meal_plan: [],
        },
      ],
    }), { params: Promise.resolve({ clientId: "client-1", protocolId }) })

    expect(res.status).toBe(500)
    const body = await json(res)
    expect(body.error).toBe("insert failed")
    expect(mocks.serviceMock.from).toHaveBeenCalledTimes(3)
  })

  it("retries day writes without role when the database schema cache is missing that column", async () => {
    const protocolId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    const dayId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const existingProtocol = {
      id: protocolId,
      client_id: "client-1",
      status: "draft",
      name: "Protocol",
      days: [{ id: dayId, position: 0, name: "Jour entraînement" }],
      schedule_slots: [],
    }

    const updatedProtocol = {
      ...existingProtocol,
      days: [{ id: dayId, position: 0, name: "Jour entraînement", calories: 1800, carbs_g: 200 }],
      schedule_slots: [],
    }

    mocks.setServiceResults([
      { data: { id: "client-1" } },
      { data: existingProtocol },
      { data: null, error: { message: "Could not find the 'role' column of 'nutrition_protocol_days' in the schema cache" } },
      { data: null },
      { data: { id: "client-1" } },
      { data: updatedProtocol },
    ])

    const res = await PATCH(makePatch({
      days: [
        {
          id: dayId,
          name: "Jour entraînement",
          position: 0,
          calories: 1800,
          protein_g: 160,
          carbs_g: 200,
          fat_g: 50,
          hydration_ml: 2500,
          role: "training",
          carb_cycle_type: "high",
          cycle_sync_phase: null,
          recommendations: null,
          meal_plan: [],
        },
      ],
    }), { params: Promise.resolve({ clientId: "client-1", protocolId }) })

    expect(res.status).toBe(200)

    const builders = mocks.serviceMock.from.mock.results.map((call) => call.value)
    expect(builders[2].update).toHaveBeenCalledWith(expect.objectContaining({ role: "training" }))
    expect(builders[3].update).toHaveBeenCalledWith(expect.not.objectContaining({ role: expect.anything() }))

    const body = await json(res)
    expect(body.protocol.days[0].role).toBe("training")
  })
})
