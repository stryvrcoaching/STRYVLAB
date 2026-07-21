import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  assessmentFoodCatalogSearchSchema,
  searchAssessmentFoodCatalog,
} from "@/lib/assessments/food-catalog"

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = serviceClient()
  const { data: submission } = await db
    .from("assessment_submissions")
    .select("id")
    .eq("id", submissionId)
    .eq("coach_id", user.id)
    .maybeSingle()
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 })

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
