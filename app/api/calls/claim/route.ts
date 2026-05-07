import { NextRequest, NextResponse } from "next/server";
import { claimCall, hasDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { conversation_id?: unknown };
  try {
    body = (await req.json()) as { conversation_id?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId =
    typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
  if (!conversationId) {
    return NextResponse.json(
      { ok: false, error: "Missing conversation_id" },
      { status: 400 }
    );
  }

  if (!hasDb()) {
    return NextResponse.json(
      { ok: false, error: "DB not configured" },
      { status: 500 }
    );
  }

  try {
    const { claimed } = await claimCall({ conversationId });
    return NextResponse.json({ ok: true, claimed });
  } catch (err) {
    console.error("[pdl-dialer] claim failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
