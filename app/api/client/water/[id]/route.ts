import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service().from("coach_clients").select("id").eq("user_id", userId).single()
  return data?.id ?? null
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { error } = await service()
    .from("client_water_logs")
    .delete()
    .eq("id", params.id)
    .eq("client_id", clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath("/client")
  revalidatePath("/client/nutrition")
  return NextResponse.json({ ok: true })
}
