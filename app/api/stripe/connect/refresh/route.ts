import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getCoachConnectAccount,
  resumeCoachConnectOnboarding,
  syncCoachConnectAccount,
} from "@/lib/stripe/connect";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state) return NextResponse.redirect(new URL("/coach/settings?stripe_connect=invalid", request.url));

  try {
    const link = await resumeCoachConnectOnboarding(state);
    return NextResponse.redirect(link.url);
  } catch {
    return NextResponse.redirect(new URL("/coach/settings?stripe_connect=error", request.url));
  }
}

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const current = await getCoachConnectAccount(user.id);
    if (!current.accountId) {
      return NextResponse.json({ error: "Aucun compte Stripe connecté." }, { status: 409 });
    }

    return NextResponse.json(await syncCoachConnectAccount(user.id, current.accountId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Actualisation Stripe indisponible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
