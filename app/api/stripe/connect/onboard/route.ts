import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createCoachConnectOnboardingUrl } from "@/lib/stripe/connect";

export const runtime = "nodejs";

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    return NextResponse.json({ url: await createCoachConnectOnboardingUrl(user.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion Stripe indisponible.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
