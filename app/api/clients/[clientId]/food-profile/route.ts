import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { coachOwnsClient } from "@/lib/security/client-resource-access"
import { foodPreferenceAssessmentSchema } from "@/lib/nutrition/food-preferences"
import {
  foodProfileValueFromRules,
  loadClientFoodProfile,
  syncClientFoodProfile,
  FoodAllergyRemovalConfirmationError,
} from "@/lib/nutrition/food-profile-service"
import { z } from "zod"

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function context(clientId: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = serviceClient()
  if (!(await coachOwnsClient({ db, coachUserId: user.id, clientId }))) return null
  return { db, user }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const auth = await context(clientId)
  if (!auth) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const profile = await loadClientFoodProfile(auth.db, clientId)
  return NextResponse.json({
    status: profile?.allergy_status ?? "unknown",
    version: profile?.version ?? 0,
    value: foodProfileValueFromRules(profile),
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const auth = await context(clientId)
  if (!auth) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const bodySchema = z.object({
    value: foodPreferenceAssessmentSchema,
    confirm_allergy_removal: z.boolean().optional().default(false),
  })
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Profil alimentaire invalide" },
      { status: 400 },
    )
  }

  try {
    const result = await syncClientFoodProfile(auth.db, {
      clientId,
      coachId: auth.user.id,
      value: parsed.data.value,
      sourceType: "coach",
      actorId: auth.user.id,
      confirmAllergyRemoval: parsed.data.confirm_allergy_removal,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof FoodAllergyRemovalConfirmationError) {
      return NextResponse.json(
        { error: error.message, confirmation_required: true },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: "Impossible d’enregistrer le profil alimentaire" }, { status: 500 })
  }
}
