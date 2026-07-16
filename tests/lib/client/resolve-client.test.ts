import { describe, expect, it, vi } from "vitest"
import { resolveClientFromUser } from "@/lib/client/resolve-client"

function makeBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: any = { _result: result }
  for (const method of ["select", "eq", "ilike", "is", "limit", "update"]) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }
  builder.single = vi.fn().mockResolvedValue(builder._result)
  builder.maybeSingle = vi.fn().mockResolvedValue(builder._result)
  return builder
}

function makeService(results: Array<{ data: unknown; error?: unknown }>) {
  const builders = results.map((result) => makeBuilder({ data: result.data, error: result.error ?? null }))
  let callIndex = 0
  return {
    builders,
    service: {
      from: vi.fn().mockImplementation(() => builders[callIndex++] ?? builders[builders.length - 1]),
    },
  }
}

describe("resolveClientFromUser", () => {
  it("relinks a client found by email when the stored user id is stale", async () => {
    const { service, builders } = makeService([
      { data: null },
      { data: null },
      { data: { id: "client-1", email: "client@test.com", user_id: "old-user" } },
      { data: null },
    ])

    const client = await resolveClientFromUser(
      "new-user",
      "client@test.com",
      service as any,
      "id, email, user_id",
    )

    expect(client?.id).toBe("client-1")
    expect(service.from).toHaveBeenNthCalledWith(3, "coach_clients")
    expect(builders[2].ilike).toHaveBeenCalledWith("email", "client@test.com")
    expect(builders[3].update).toHaveBeenCalledWith({ user_id: "new-user" })
    expect(builders[3].eq).toHaveBeenCalledWith("id", "client-1")
  })

  it("allows a coach test account to resolve a client row by exact email match", async () => {
    const { service, builders } = makeService([
      { data: null },
      { data: { id: "coach-profile-1" } },
      { data: { id: "client-1", email: "client@test.com", user_id: null } },
      { data: null },
    ])

    const client = await resolveClientFromUser(
      "coach-user",
      "client@test.com",
      service as any,
      "id, email, user_id",
    )

    expect(client?.id).toBe("client-1")
    expect(service.from).toHaveBeenCalledTimes(4)
    expect(builders[2].ilike).toHaveBeenCalledWith("email", "client@test.com")
    expect(builders[3].update).toHaveBeenCalledWith({ user_id: "coach-user" })
  })
})
