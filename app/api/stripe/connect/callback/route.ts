import { NextRequest, NextResponse } from "next/server";
import {
  completeCoachConnectOnboarding,
  getPublicAppUrl,
} from "@/lib/stripe/connect";

export const runtime = "nodejs";

function settingsRedirect(result: string) {
  const url = new URL("/coach/settings", getPublicAppUrl());
  url.searchParams.set("stripe_connect", result);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state) return settingsRedirect("invalid");

  try {
    const account = await completeCoachConnectOnboarding(state);
    return settingsRedirect(account.status === "ready" ? "ready" : "pending");
  } catch {
    return settingsRedirect("error");
  }
}
