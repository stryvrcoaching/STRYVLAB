import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  assessmentFoodCatalogSearchSchema,
  searchAssessmentFoodCatalog,
} from "@/lib/assessments/food-catalog"
import { isValidPublicAssessmentToken } from "@/lib/assessments/public-response-security"
import { checkPublicRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit"

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const db = serviceClient()
  if (!isValidPublicAssessmentToken(token)) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 })
  }
  const rateLimit = await checkPublicRateLimit({
    db,
    req,
    scope: "public_assessment_food_catalog",
    subject: token,
    maxRequests: 120,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const { data: submission } = await db
    .from("assessment_submissions")
    .select("id, status, token_expires_at")
    .eq("token", token)
    .maybeSingle()
  if (
    !submission ||
    ["completed", "expired"].includes(submission.status) ||
    !submission.token_expires_at ||
    new Date(submission.token_expires_at) < new Date()
  ) {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 410 })
  }

  const parsed = assessmentFoodCatalogSearchSchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) return NextResponse.json({ error: "Recherche invalide" }, { status: 400 })

  try {
    return NextResponse.json({
      data: await searchAssessmentFoodCatalog(db, parsed.data),
    })
  } catch {
    return NextResponse.json({ error: "Catalogue indisponible" }, { status: 500 })
  }
}
