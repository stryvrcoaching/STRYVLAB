import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMocks } from "../mocks/supabase"
import { NextRequest } from "../mocks/next-server"

const mocks = createSupabaseMocks()

vi.mock("@/utils/supabase/server", () => ({ createClient: () => mocks.serverMock }))
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.serviceMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/security/public-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 }),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))

const createMock = vi.fn()
const fetchMock = vi.fn()
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    }
  },
}))

import { GET as getSession, POST as createSession } from "@/app/api/client/nutrition/photo-log/route"
import { POST as analyzeSession } from "@/app/api/client/nutrition/photo-log/analyze/route"
import { POST as clarifySession } from "@/app/api/client/nutrition/photo-log/clarify/route"
import { POST as logSession } from "@/app/api/client/nutrition/photo-log/log/route"
import { POST as refineLeftovers } from "@/app/api/client/nutrition/photo-log/refine-leftovers/route"
import { POST as uploadPhoto, DELETE as deletePhoto } from "@/app/api/client/nutrition/photo-log/upload-photo/route"

beforeEach(() => {
  mocks.resetMocks()
  createMock.mockReset()
  fetchMock.mockReset()
  process.env.OPENAI_API_KEY = "test-key"
  vi.stubGlobal("fetch", fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith("https://example.com/")) {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    }
    throw new Error(`Unhandled fetch in test: ${url}`)
  }))
})

function makeJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("photo-guided nutrition logging API", () => {
  it("creates a new photo-log session", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1", timezone: "Europe/Paris" }, error: null },
      { data: { id: "session-1", status: "capturing" }, error: null },
    ])

    const response = await createSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log", {
        date: "2026-06-22",
        manual_weight_g: 320,
      }) as any,
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data.id).toBe("session-1")
  })

  it("loads the latest photo-log session by meal id", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_id: "meal-1",
          status: "refined",
          leftovers_weight_g: 80,
        },
        error: null,
      },
    ])

    const response = await getSession(
      new NextRequest("http://localhost/api/client/nutrition/photo-log?meal_id=meal-1") as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.meal_id).toBe("meal-1")
    expect(body.data.leftovers_weight_g).toBe(80)
  })

  it("deletes an uploaded photo and its storage object", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      { data: { id: "session-1" }, error: null },
      { data: { id: "photo-1", storage_path: "client-1/session-1/photo-1.jpg" }, error: null },
      { data: null, error: null },
    ])

    const response = await deletePhoto(
      new NextRequest("http://localhost/api/client/nutrition/photo-log/upload-photo?session_id=session-1&photo_id=photo-1", {
        method: "DELETE",
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.serviceMock.storage.from).toHaveBeenCalledWith("nutrition-photo-logs")
    expect(mocks.serviceMock.storage.from().remove).toHaveBeenCalledWith(["client-1/session-1/photo-1.jpg"])
  })

  it("prepares a direct signed upload URL for a photo", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      { data: { id: "session-1" }, error: null },
    ])

    const response = await uploadPhoto(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/upload-photo", {
        intent: "prepare",
        session_id: "session-1",
        kind: "context",
        file_extension: "jpg",
        file_size: 3_500_000,
        content_type: "image/jpeg",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.upload_url).toBe("https://example.com/upload")
    expect(body.storage_path).toContain("client-1/session-1/")
    expect(body.storage_path).toContain("-context.jpg")
    expect(mocks.serviceMock.storage.from().createSignedUploadUrl).toHaveBeenCalled()
  })

  it("prepares an upload URL even when the session must be recovered from session ownership fallback", async () => {
    mocks.setServerUser({ id: "user-1", email: "client@test.com" })
    mocks.setServiceResults([
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: {
          id: "session-1",
          client_id: "client-1",
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          id: "client-1",
          user_id: null,
          email: "client@test.com",
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await uploadPhoto(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/upload-photo", {
        intent: "prepare",
        session_id: "session-1",
        kind: "top",
        file_extension: "jpg",
        file_size: 3_500_000,
        content_type: "image/jpeg",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.storage_path).toContain("client-1/session-1/")
    expect(body.upload_url).toBe("https://example.com/upload")
  })

  it("completes a direct upload and creates the photo record", async () => {
    const storagePath = "client-1/session-1/123e4567-e89b-12d3-a456-426614174000-side.jpg"
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      { data: { id: "session-1" }, error: null },
      { data: { position_index: 1 }, error: null },
      { data: { id: "photo-2", kind: "side", signed_url: "https://example.com/signed.jpg" }, error: null },
    ])

    const response = await uploadPhoto(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/upload-photo", {
        intent: "complete",
        session_id: "session-1",
        kind: "side",
        storage_path: storagePath,
      }) as any,
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data.id).toBe("photo-2")
    expect(body.data.signed_url).toBe("https://example.com/signed.jpg")
    expect(mocks.serviceMock.storage.from().download).toHaveBeenCalledWith(storagePath)
    expect(mocks.serviceMock.storage.from().createSignedUrl).toHaveBeenCalledWith(storagePath, 60 * 60)
  })

  it("rejects a direct upload path owned by another session", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      { data: { id: "session-1" }, error: null },
    ])

    const response = await uploadPhoto(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/upload-photo", {
        intent: "complete",
        session_id: "session-1",
        kind: "side",
        storage_path: "client-1/session-2/123e4567-e89b-12d3-a456-426614174000-side.jpg",
      }) as any,
    )

    expect(response.status).toBe(400)
    expect(mocks.serviceMock.storage.from().download).not.toHaveBeenCalled()
  })

  it("analyzes a session and returns a clarification question when ambiguity remains", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meal_type: "lunch",
              scale_weight_g: 320,
              scale_weight_confidence: 0.96,
              components: [
                {
                  name_fr: "Riz",
                  category_hint: "carbs",
                  grams_estimate: 180,
                  kcal_per_100g: 130,
                  protein_per_100g: 2.5,
                  carbs_per_100g: 28,
                  fat_per_100g: 0.3,
                  fiber_per_100g: 0.4,
                  ambiguity_tags: ["cooked_vs_raw"],
                },
              ],
              ambiguity_tags: [],
              leftovers_recommended: false,
            }),
          },
        },
      ],
    })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: null,
          manual_weight_g: 320,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/top.jpg", storage_path: "client-1/session-1/top.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/side.jpg", storage_path: "client-1/session-1/side.jpg", position_index: 1, created_at: "2026-06-22T12:00:01.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.result.pending_question.key).toBe("starch_state")
    expect(body.data.result.ready_to_log).toBe(false)
    expect(mocks.serviceMock.storage.from().createSignedUrl).toHaveBeenCalledWith("client-1/session-1/top.jpg", 60 * 10)
  })

  it("analyzes a session still owned through email fallback even if the client link is not stabilized yet", async () => {
    mocks.setServerUser({ id: "user-1", email: "client@test.com" })
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meal_type: "lunch",
              scale_weight_g: 284,
              scale_weight_confidence: 0.92,
              components: [
                {
                  name_fr: "Poulet grille",
                  category_hint: "proteins",
                  grams_estimate: 148,
                  kcal_per_100g: 190,
                  protein_per_100g: 27,
                  carbs_per_100g: 0,
                  fat_per_100g: 8,
                  fiber_per_100g: 0,
                  ambiguity_tags: [],
                },
                {
                  name_fr: "Riz cuit",
                  category_hint: "carbs",
                  grams_estimate: 136,
                  kcal_per_100g: 130,
                  protein_per_100g: 2.5,
                  carbs_per_100g: 28,
                  fat_per_100g: 0.3,
                  fiber_per_100g: 0.4,
                  ambiguity_tags: [],
                },
              ],
              ambiguity_tags: [],
              leftovers_recommended: false,
            }),
          },
        },
      ],
    })

    mocks.setServiceResults([
      { data: null, error: null },
      { data: null, error: null },
      {
        data: {
          id: "client-2",
          email: "client@test.com",
          display_lang: "fr",
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          id: "session-1",
          client_id: "client-1",
          meal_type: "lunch",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/top.jpg", position_index: 0, created_at: "2026-07-04T12:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/side.jpg", position_index: 1, created_at: "2026-07-04T12:00:01.000Z" },
            { kind: "scale_zoom", signed_url: "https://example.com/scale.jpg", position_index: 2, created_at: "2026-07-04T12:00:02.000Z" },
            { kind: "leftovers", signed_url: "https://example.com/leftovers.jpg", position_index: 3, created_at: "2026-07-04T12:20:00.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          id: "client-1",
          user_id: null,
          email: "client@test.com",
          display_lang: "fr",
        },
        error: null,
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.result.components).toHaveLength(2)
    expect(body.data.result.ready_to_log).toBe(true)
  })

  it("feeds the analysis model with inlined storage images when storage paths are available", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meal_type: "lunch",
              components: [
                {
                  name_fr: "Riz",
                  category_hint: "carbs",
                  grams_estimate: 180,
                  kcal_per_100g: 130,
                  protein_per_100g: 2.5,
                  carbs_per_100g: 28,
                  fat_per_100g: 0.3,
                  fiber_per_100g: 0.4,
                  ambiguity_tags: [],
                },
              ],
              ambiguity_tags: [],
              leftovers_recommended: false,
            }),
          },
        },
      ],
    })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "lunch",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/top.jpg", storage_path: "client-1/session-1/top.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.serviceMock.storage.from().download).toHaveBeenCalledWith("client-1/session-1/top.jpg")
  })

  it("reruns a real plate analysis when the first pass returns zero macros", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "plate",
                meal_type: "lunch",
                source_context: "plate_home_v1",
                scale_weight_g: 0,
                scale_weight_confidence: 0,
                components: [
                  {
                    name_fr: "Repas visible",
                    category_hint: "extras",
                    grams_estimate: 0,
                    kcal_per_100g: 0,
                    protein_per_100g: 0,
                    carbs_per_100g: 0,
                    fat_per_100g: 0,
                    fiber_per_100g: 0,
                    ambiguity_tags: [],
                  },
                ],
                photo_timeline: [
                  { index: 1, role: "before_meal", evidence: "Assiette visible avec riz, poulet et avocat." },
                ],
                ambiguity_tags: [],
                leftovers_recommended: false,
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "plate",
                meal_type: "lunch",
                source_context: "plate_home_v1",
                components: [
                  {
                    name_fr: "Riz cuit",
                    category_hint: "carbs",
                    grams_estimate: 160,
                    kcal_per_100g: 130,
                    protein_per_100g: 2.7,
                    carbs_per_100g: 28,
                    fat_per_100g: 0.3,
                    fiber_per_100g: 0.4,
                    ambiguity_tags: [],
                  },
                  {
                    name_fr: "Poulet grillé",
                    category_hint: "proteins",
                    grams_estimate: 180,
                    kcal_per_100g: 190,
                    protein_per_100g: 27,
                    carbs_per_100g: 0,
                    fat_per_100g: 8,
                    fiber_per_100g: 0,
                    ambiguity_tags: [],
                  },
                  {
                    name_fr: "Avocat",
                    category_hint: "fats",
                    grams_estimate: 70,
                    kcal_per_100g: 160,
                    protein_per_100g: 2,
                    carbs_per_100g: 8.5,
                    fat_per_100g: 14.7,
                    fiber_per_100g: 6.7,
                    ambiguity_tags: [],
                  },
                ],
                ambiguity_tags: [],
                leftovers_recommended: false,
                vision_notes: "Assiette réestimée après résultat nul.",
              }),
            },
          },
        ],
      })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "lunch",
          source_context: "plate_home_v1",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/plate.jpg", position_index: 0, created_at: "2026-07-01T12:00:00.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(createMock).toHaveBeenCalledTimes(2)
    expect(body.data.result.components).toHaveLength(3)
    expect(body.data.result.components[0].kcal_per_100g).toBeGreaterThan(0)
    expect(body.data.result.validation_issues).not.toContain("Le repas visible ne peut pas produire 0 kcal. Analyse à reprendre ou à corriger.")
  })

  it("returns a clear retry message when the model cannot load a photo", async () => {
    createMock
      .mockRejectedValueOnce(new Error("Load failed"))
      .mockRejectedValueOnce(new Error("Load failed"))

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "lunch",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/top.jpg", storage_path: "client-1/session-1/top.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
          ],
        },
        error: null,
      },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain("Supprime-la puis réimporte-la")
  })

  it("retries the analysis once with direct signed urls after a transient photo load failure", async () => {
    createMock
      .mockRejectedValueOnce(new Error("load file head failed"))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "packaging",
                meal_type: "snack",
                source_context: "product_packaging_v1",
                scale_weight_g: 0,
                scale_weight_confidence: 0,
                confidence_breakdown: {
                  capture: 0.95,
                  ocr: 0.95,
                  quantity: 0.9,
                  nutrition: 0.95,
                },
                components: [
                  {
                    name_fr: "Boisson énergisante",
                    category_hint: "drinks",
                    grams_estimate: 250,
                    kcal_per_100g: 45,
                    protein_per_100g: 0,
                    carbs_per_100g: 11,
                    fat_per_100g: 0,
                    fiber_per_100g: 0,
                    ambiguity_tags: [],
                  },
                ],
                ambiguity_tags: [],
                leftovers_recommended: false,
              }),
            },
          },
        ],
      })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "snack",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/top.jpg", storage_path: "client-1/session-1/top.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it("retries storage download before giving up on a newly uploaded photo", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              analysis_mode: "packaging",
              meal_type: "snack",
              source_context: "product_packaging_v1",
              scale_weight_g: 0,
              scale_weight_confidence: 0,
              confidence_breakdown: {
                capture: 0.95,
                ocr: 0.95,
                quantity: 0.9,
                nutrition: 0.95,
              },
              components: [
                {
                  name_fr: "Boisson énergisante",
                  category_hint: "drinks",
                  grams_estimate: 250,
                  kcal_per_100g: 45,
                  protein_per_100g: 0,
                  carbs_per_100g: 11,
                  fat_per_100g: 0,
                  fiber_per_100g: 0,
                  ambiguity_tags: [],
                },
              ],
              ambiguity_tags: [],
              leftovers_recommended: false,
            }),
          },
        },
      ],
    })

    mocks.serviceMock.storage.from().download
      .mockResolvedValueOnce({ data: null, error: { message: "not_ready" } })
      .mockResolvedValueOnce({ data: null, error: { message: "not_ready" } })
      .mockResolvedValueOnce({
        data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
        error: null,
      })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "snack",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/top.jpg", storage_path: "client-1/session-1/top.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.serviceMock.storage.from().download).toHaveBeenCalledTimes(3)
  })

  it("passes ordered multi-photo context to the analysis model", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meal_type: "lunch",
              scale_weight_g: 500,
              scale_weight_confidence: 0.8,
              photo_timeline: [
                { index: 1, role: "before_meal", evidence: "assiette pleine" },
                { index: 3, role: "after_meal_leftovers", evidence: "restes visibles" },
              ],
              leftovers_estimate: {
                detected: true,
                grams_estimate: 120,
                confidence: 0.7,
                rationale: "restes sur les photos apres repas",
              },
              components: [
                {
                  name_fr: "Poulet roti",
                  category_hint: "proteins",
                  grams_estimate: 140,
                  kcal_per_100g: 239,
                  protein_per_100g: 27,
                  carbs_per_100g: 0,
                  fat_per_100g: 14,
                  fiber_per_100g: 0,
                  ambiguity_tags: ["non_edible_parts"],
                },
              ],
              ambiguity_tags: [],
              leftovers_recommended: true,
            }),
          },
        },
      ],
    })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: null,
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/before-top.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/before-side.jpg", position_index: 1, created_at: "2026-06-22T12:00:01.000Z" },
            { kind: "scale_zoom", signed_url: "https://example.com/after-top.jpg", position_index: 2, created_at: "2026-06-22T12:20:00.000Z" },
            { kind: "scale_zoom", signed_url: "https://example.com/after-side.jpg", position_index: 3, created_at: "2026-06-22T12:20:01.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
        manual_detail: "Deux photos avant, deux photos apres avec les restes.",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.analysis.photo_timeline?.[1].role).toBe("after_meal_leftovers")
    expect(body.data.analysis.leftovers_estimate?.detected).toBe(true)

    const firstCall = createMock.mock.calls[0][0]
    const userContent = firstCall.messages[1].content
    expect(userContent.some((part: any) => part.type === "text" && part.text.includes("Nombre de photos dans cette session: 4"))).toBe(true)
    expect(userContent.some((part: any) => part.type === "text" && part.text.includes("Photo 3") && part.text.includes("scale_zoom"))).toBe(true)
    expect(userContent.some((part: any) => part.type === "text" && part.text.includes("ne décrit pas son contenu"))).toBe(true)
  })

  it("keeps the user meal type and builds a packaging result from label plus note", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              analysis_mode: "packaging",
              meal_type: "lunch",
              source_context: "product_packaging_v1",
              confidence_breakdown: {
                capture: 0.95,
                ocr: 0.96,
                quantity: 0.97,
                nutrition: 0.96,
              },
              product_reference: {
                brand: "QNT Life",
                name_fr: "Light Digest Whey Protein",
                canonical_name_fr: "QNT Life Light Digest Whey Protein",
                product_type: "whey",
                serving_size_g: 40,
                serving_label: "40 g",
                evidence: "face avant + tableau nutritionnel",
                save_to_personal_library: true,
              },
              scale_weight_g: 0,
              scale_weight_confidence: 0,
              components: [
                {
                  name_fr: "Poudre de protéine",
                  category_hint: "proteins",
                  grams_estimate: 40,
                  kcal_per_100g: 362.5,
                  protein_per_100g: 70,
                  carbs_per_100g: 8.85,
                  fat_per_100g: 4.7,
                  fiber_per_100g: 0,
                  ambiguity_tags: [],
                  rationale: "Valeurs lues sur l'étiquette pour une portion de 40 g.",
                },
              ],
              ambiguity_tags: [],
              leftovers_recommended: false,
              vision_notes: "Produit emballé détecté. Tableau nutritionnel lisible.",
            }),
          },
        },
      ],
    })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
          meal_type: "snack",
          source_context: "plate_home_v1",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/front.jpg", position_index: 0, created_at: "2026-06-22T12:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/back.jpg", position_index: 1, created_at: "2026-06-22T12:00:01.000Z" },
            { kind: "scale_zoom", signed_url: "https://example.com/nutrition.jpg", position_index: 2, created_at: "2026-06-22T12:00:02.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
        manual_detail: "Ajoute ce complément dans ma bibliothèque d'aliments perso et pour ce shaker j'ai mis 250 ml de lait demi-écrémé et 40 g de cette poudre.",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    console.log(JSON.stringify(body, null, 2))
    expect(body.data.analysis.analysis_mode).toBe("packaging")
    expect(body.data.result.analysis_mode).toBe("packaging")
    expect(body.data.result.meal_type).toBe("snack")
    expect(body.data.result.pending_question).toBeNull()
    expect(body.data.result.components).toHaveLength(2)
    expect(body.data.result.components[0].name_fr).toBe("QNT Life Light Digest Whey Protein")
    expect(body.data.result.components[1].name_fr).toBe("Lait demi-écrémé")

    const totals = body.data.result.components.reduce((acc: any, component: any) => {
      const factor = component.quantity_g / 100
      acc.kcal += component.kcal_per_100g * factor
      acc.protein += component.protein_per_100g * factor
      acc.carbs += component.carbs_per_100g * factor
      acc.fat += component.fat_per_100g * factor
      return acc
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })

    expect(Math.round(totals.kcal)).toBe(260)
    expect(totals.protein).toBeCloseTo(36.5, 1)
    expect(totals.carbs).toBeCloseTo(15.54, 1)
    expect(totals.fat).toBeCloseTo(5.68, 1)
  })

  it("rescues a packaged protein bar when the first packaging pass returns zeros", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "packaging",
                meal_type: "snack",
                source_context: "product_packaging_v1",
                product_reference: {
                  brand: "Pulse",
                  name_fr: "Pistachio Protein Bar",
                  canonical_name_fr: "Pulse Pistachio Protein Bar",
                  product_type: "snack",
                  serving_size_g: 55,
                  serving_label: "55 g",
                  barcode_text: "5430004539698",
                  evidence: "face avant + code-barres",
                },
                scale_weight_g: 0,
                scale_weight_confidence: 0,
                components: [
                  {
                    name_fr: "Barre protéinée",
                    category_hint: "proteins",
                    grams_estimate: 55,
                    kcal_per_100g: 0,
                    protein_per_100g: 0,
                    carbs_per_100g: 0,
                    fat_per_100g: 0,
                    fiber_per_100g: 0,
                    ambiguity_tags: [],
                    rationale: "Produit reconnu mais lecture nutritionnelle ratée.",
                  },
                ],
                ambiguity_tags: [],
                leftovers_recommended: false,
                vision_notes: "Produit emballé détecté.",
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "packaging",
                source_context: "product_packaging_v1",
                product_reference: {
                  brand: "Pulse",
                  name_fr: "Pistachio Protein Bar",
                  canonical_name_fr: "Pulse Pistachio Protein Bar",
                  product_type: "snack",
                  serving_size_g: 55,
                  serving_label: "55 g",
                  barcode_text: "5430004539698",
                  evidence: "tableau nutritionnel + poids unitaire",
                },
                components: [
                  {
                    name_fr: "Pulse Pistachio Protein Bar",
                    category_hint: "proteins",
                    grams_estimate: 55,
                    kcal_per_100g: 414.5,
                    protein_per_100g: 25.45,
                    carbs_per_100g: 18.18,
                    fat_per_100g: 26.9,
                    fiber_per_100g: 7.27,
                    ambiguity_tags: [],
                    rationale: "Valeurs reconstruites depuis la portion 55 g et le tableau visible.",
                  },
                ],
                vision_notes: "Barre protéinée emballée, tableau nutritionnel lisible.",
              }),
            },
          },
        ],
      })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "snack",
          source_context: "plate_home_v1",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/front.jpg", position_index: 0, created_at: "2026-06-30T20:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/back.jpg", position_index: 1, created_at: "2026-06-30T20:00:01.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.result.ready_to_log).toBe(true)
    expect(body.data.result.components).toHaveLength(1)
    expect(body.data.result.components[0].name_fr).toBe("Pulse Pistachio Protein Bar")
    expect(Math.round(body.data.result.components[0].quantity_g)).toBe(55)
    expect(body.data.result.components[0].kcal_per_100g).toBeGreaterThan(400)
    expect(body.data.result.components[0].protein_per_100g).toBeGreaterThan(20)
  })

  it("rescues a packaged protein bar when the first packaging pass is calorie-macro incoherent", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "packaging",
                meal_type: "snack",
                source_context: "product_packaging_v1",
                product_reference: {
                  brand: "Pulse",
                  name_fr: "Pistachio Protein Bar",
                  canonical_name_fr: "Pulse Pistachio Protein Bar",
                  product_type: "snack",
                  serving_size_g: 55,
                  serving_label: "55 g",
                  barcode_text: "5430004539698",
                  evidence: "face avant + claim protéiné",
                },
                scale_weight_g: 0,
                scale_weight_confidence: 0,
                components: [
                  {
                    name_fr: "Pulse Pistachio Protein Bar",
                    category_hint: "proteins",
                    grams_estimate: 55,
                    kcal_per_100g: 178.2,
                    protein_per_100g: 27.3,
                    carbs_per_100g: 18.2,
                    fat_per_100g: 10.9,
                    fiber_per_100g: 0,
                    ambiguity_tags: [],
                    rationale: "Lecture partielle combinée face avant + portion.",
                  },
                ],
                ambiguity_tags: [],
                leftovers_recommended: false,
                vision_notes: "Barre détectée mais tableau partiellement lu.",
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis_mode: "packaging",
                source_context: "product_packaging_v1",
                product_reference: {
                  brand: "Pulse",
                  name_fr: "Pistachio Protein Bar",
                  canonical_name_fr: "Pulse Pistachio Protein Bar",
                  product_type: "snack",
                  serving_size_g: 55,
                  serving_label: "55 g",
                  barcode_text: "5430004539698",
                  evidence: "tableau nutritionnel 100 g + 55 g",
                },
                components: [
                  {
                    name_fr: "Pulse Pistachio Protein Bar",
                    category_hint: "proteins",
                    grams_estimate: 55,
                    kcal_per_100g: 414.5,
                    protein_per_100g: 25.45,
                    carbs_per_100g: 18.18,
                    fat_per_100g: 26.9,
                    fiber_per_100g: 7.27,
                    ambiguity_tags: [],
                    rationale: "Valeurs relues depuis la colonne 100 g et vérifiées avec la portion 55 g.",
                  },
                ],
                vision_notes: "Tableau lisible avec colonnes 100 g et barre.",
              }),
            },
          },
        ],
      })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "snack",
          source_context: "plate_home_v1",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/front.jpg", position_index: 0, created_at: "2026-06-30T20:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/back.jpg", position_index: 1, created_at: "2026-06-30T20:00:01.000Z" },
            { kind: "side", signed_url: "https://example.com/barcode.jpg", position_index: 2, created_at: "2026-06-30T20:00:02.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.analysis.analysis_mode).toBe("packaging")
    expect(body.data.result.ready_to_log).toBe(true)
    expect(body.data.result.components).toHaveLength(1)
    expect(body.data.result.components[0].kcal_per_100g).toBeGreaterThan(400)
    expect(body.data.result.components[0].fat_per_100g).toBeGreaterThan(20)
  })

  it("overrides a packaged protein bar with barcode nutrition when vision keeps the wrong macro split", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("https://example.com/")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      }
      if (url.startsWith("https://world.openfoodfacts.org/api/v2/product/5430004539698.json")) {
        return new Response(
          JSON.stringify({
            status: 1,
            code: "5430004539698",
            product_name: "Vegan Protein Bar Pistachio",
            brands: "Pulse",
            quantity: "55 g",
            serving_size: "1 bar (55 g)",
            nutriments: {
              "energy-kcal_100g": 410.909090909091,
              proteins_100g: 24.9090909090909,
              carbohydrates_100g: 18.1818181818182,
              fat_100g: 26.5454545454545,
              fiber_100g: 6.18181818181818,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      throw new Error(`Unhandled fetch in test: ${url}`)
    })

    const wrongBarAnalysis = {
      analysis_mode: "packaging",
      meal_type: "snack",
      source_context: "product_packaging_v1",
      product_reference: {
        brand: "Pulse",
        name_fr: "Pistachio Protein Bar",
        canonical_name_fr: "Pulse Pistachio Protein Bar",
        product_type: "snack",
        serving_size_g: 55,
        serving_label: "55 g",
        barcode_text: "5430004539698",
        evidence: "face avant + code-barres",
      },
      scale_weight_g: 0,
      scale_weight_confidence: 0,
      components: [
        {
          name_fr: "Pulse Pistachio Protein Bar",
          category_hint: "proteins",
          grams_estimate: 55,
          kcal_per_100g: 178.2,
          protein_per_100g: 27.3,
          carbs_per_100g: 18.2,
          fat_per_100g: 10.9,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Lecture partielle depuis le claim frontal.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
      vision_notes: "Barre détectée.",
    }

    createMock
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(wrongBarAnalysis) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(wrongBarAnalysis) } }],
      })

    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_type: "snack",
          source_context: "plate_home_v1",
          manual_weight_g: null,
          clarification_answers: {},
          client_photo_meal_log_photos: [
            { kind: "top", signed_url: "https://example.com/front.jpg", position_index: 0, created_at: "2026-06-30T20:00:00.000Z" },
            { kind: "side", signed_url: "https://example.com/back.jpg", position_index: 1, created_at: "2026-06-30T20:00:01.000Z" },
            { kind: "side", signed_url: "https://example.com/barcode.jpg", position_index: 2, created_at: "2026-06-30T20:00:02.000Z" },
          ],
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await analyzeSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/analyze", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    const component = body.data.result.components[0]
    expect(body.data.result.ready_to_log).toBe(true)
    expect(component.name_fr).toBe("Pulse Vegan Protein Bar Pistachio")
    expect(component.quantity_g).toBe(55)
    expect(component.kcal_per_100g).toBeCloseTo(410.9, 1)
    expect(component.protein_per_100g).toBeCloseTo(24.9, 1)
    expect(component.carbs_per_100g).toBeCloseTo(18.2, 1)
    expect(component.fat_per_100g).toBeCloseTo(26.5, 1)
  })

  it("applies a clarification answer and returns a ready result when no more questions remain", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          analysis_summary: {
            meal_type: "lunch",
            scale_weight_g: 320,
            scale_weight_confidence: 0.96,
            manual_weight_g: null,
            components: [
              {
                name_fr: "Poulet grille",
                category_hint: "proteins",
                grams_estimate: 320,
                kcal_per_100g: 165,
                protein_per_100g: 31,
                carbs_per_100g: 0,
                fat_per_100g: 3.6,
                fiber_per_100g: 0,
                ambiguity_tags: [],
              },
            ],
            ambiguity_tags: [],
            leftovers_recommended: false,
          },
          clarification_answers: {},
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await clarifySession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/clarify", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
        key: "fat_type",
        value: "none",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.ready_to_log).toBe(true)
  })

  it("applies the extra egg whites clarification and returns split egg components", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          analysis_summary: {
            meal_type: "breakfast",
            analysis_mode: "plate",
            source_context: "plate_home_v1",
            scale_weight_g: null,
            scale_weight_confidence: null,
            manual_weight_g: null,
            manual_detail: null,
            components: [
              {
                name_fr: "Oeuf au plat",
                category_hint: "proteins",
                grams_estimate: 0,
                unit_count: 1,
                kcal_per_100g: 170,
                protein_per_100g: 13,
                carbs_per_100g: 1,
                fat_per_100g: 12,
                fiber_per_100g: 0,
                ambiguity_tags: [],
              },
            ],
            ambiguity_tags: [],
            leftovers_recommended: false,
          },
          clarification_answers: {},
        },
        error: null,
      },
      { data: null, error: null },
    ])

    const response = await clarifySession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/clarify", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
        key: "egg_white_extra_g",
        value: "240",
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.ready_to_log).toBe(true)
    expect(body.data.components.map((component: any) => component.name_fr)).toEqual(["Blanc d'oeuf", "Jaune d'oeuf"])
  })

  it("logs a ready photo-guided session into nutrition_meals", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1", timezone: "Europe/Paris" }, error: null },
      {
        data: {
          id: "session-1",
          physiological_date: "2026-06-22",
          meal_type: "lunch",
          analysis_result: {
            meal_type: "lunch",
            status_copy: "Analyse affinee avec ton poids",
            ready_to_log: true,
            leftovers_recommended: false,
            pending_question: null,
            components: [
              {
                name_fr: "Poulet grille",
                category_hint: "proteins",
                quantity_g: 180,
                kcal_per_100g: 165,
                protein_per_100g: 31,
                carbs_per_100g: 0,
                fat_per_100g: 3.6,
                fiber_per_100g: 0,
              },
            ],
          },
        },
        error: null,
      },
      {
        data: [{ id: "food-1", name_fr: "Poulet grille", source: "internal", is_verified: true, client_id: null }],
        error: null,
      },
      {
        data: [{ id: "food-1", kcal_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, fiber_per_100g: 0 }],
        error: null,
      },
      { data: { id: "meal-1" }, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])

    const response = await logSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/log", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data.id).toBe("meal-1")
  })

  it("returns the existing meal when a mobile retry repeats a completed save", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1", timezone: "Europe/Paris" }, error: null },
      { data: { id: "session-1", status: "logged", meal_id: "meal-1" }, error: null },
      { data: { id: "meal-1", total_calories: 600 }, error: null },
    ])

    const response = await logSession(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/log", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
      }) as any,
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data.id).toBe("meal-1")
  })

  it("refines a logged photo-guided meal with leftovers weight", async () => {
    mocks.setServiceResults([
      { data: { id: "client-1" }, error: null },
      {
        data: {
          id: "session-1",
          meal_id: "meal-1",
          status: "logged",
          analysis_summary: {
            meal_type: "lunch",
            scale_weight_g: 400,
            scale_weight_confidence: 0.98,
            manual_weight_g: null,
            components: [
              {
                name_fr: "Poulet grille",
                category_hint: "proteins",
                grams_estimate: 400,
                kcal_per_100g: 165,
                protein_per_100g: 31,
                carbs_per_100g: 0,
                fat_per_100g: 3.6,
                fiber_per_100g: 0,
                ambiguity_tags: [],
              },
            ],
            ambiguity_tags: [],
            leftovers_recommended: true,
          },
        },
        error: null,
      },
      {
        data: { id: "meal-1", notes: "Analyse affinee avec ton poids" },
        error: null,
      },
      {
        data: [
          {
            id: "entry-1",
            quantity_g: 200,
            food_item_id: "food-1",
            food_items: {
              id: "food-1",
              name_fr: "Poulet grille",
              category_l1: "proteins",
              category_l2: null,
              item_key: "poulet-grille",
              kcal_per_100g: 165,
              protein_per_100g: 31,
              carbs_per_100g: 0,
              fat_per_100g: 3.6,
              fiber_per_100g: 0,
              source: "internal",
              is_verified: true,
            },
          },
        ],
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])

    const response = await refineLeftovers(
      makeJsonRequest("http://localhost/api/client/nutrition/photo-log/refine-leftovers", {
        session_id: "0f6d08ea-9cdd-4a2e-b52e-b6ac48e4b201",
        leftovers_weight_g: 100,
      }) as any,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.baseline_weight_g).toBe(400)
    expect(body.data.consumed_factor).toBeCloseTo(0.75)
    expect(body.data.meal_totals.total_calories).toBeGreaterThan(0)
  })
})
