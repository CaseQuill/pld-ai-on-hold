import { NextResponse } from "next/server";
import { hasDb, listRecentCalls } from "@/lib/db";
import { sweepStuckCalls } from "@/lib/no-answer-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  // Opt-in sweep: when enabled, before returning the list we scan active
  // rows older than 30s and ask EL whether each call ever connected. Rows
  // that EL has settled with zero duration get flipped to no_answer.
  if (process.env.NO_ANSWER_SWEEP_ENABLED === "1") {
    try {
      await sweepStuckCalls();
    } catch (err) {
      console.error("[pdl-dialer] no-answer sweep failed:", err);
    }
  }

  try {
    const rows = await listRecentCalls(50);
    return NextResponse.json({ ok: true, calls: rows });
  } catch (err) {
    console.error("[pdl-dialer] Failed to list calls:", err);
    return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
  }
}
