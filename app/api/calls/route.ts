import { NextResponse } from "next/server";
import { hasDb, listRecentCalls } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  try {
    const rows = await listRecentCalls(50);
    return NextResponse.json({ ok: true, calls: rows });
  } catch (err) {
    console.error("[pdl-dialer] Failed to list calls:", err);
    return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
  }
}
