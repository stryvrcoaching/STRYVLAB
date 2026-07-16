import { NextRequest, NextResponse } from "next/server";
import { runAdaptiveTdeeNightly } from "@/lib/nutrition/adaptiveTdeeNightly";

function isAuthorized(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  const custom = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) return false;
  if (custom === expected) return true;
  if (bearer === `Bearer ${expected}`) return true;
  return false;
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAdaptiveTdeeNightly();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/adaptive-tdee]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
