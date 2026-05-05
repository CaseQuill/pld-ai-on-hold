import { NextRequest, NextResponse } from "next/server";
import { hasDb, recordHoldTime } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  conversation_id?: string;
  estimated_minutes?: number | string;
};

export async function POST(req: NextRequest) {
  const secret = process.env.EL_TOOL_SECRET;
  if (!secret) {
    console.error("[pdl-dialer] EL_TOOL_SECRET not set");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId = (body.conversation_id ?? "").trim();
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "Missing conversation_id" }, { status: 400 });
  }

  const minutesRaw = body.estimated_minutes;
  const minutes = typeof minutesRaw === "string" ? parseInt(minutesRaw, 10) : minutesRaw;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0 || minutes > 600) {
    return NextResponse.json(
      { ok: false, error: "estimated_minutes must be an integer 0–600" },
      { status: 400 }
    );
  }

  if (!hasDb()) {
    return NextResponse.json({ ok: false, error: "DB not configured" }, { status: 500 });
  }

  try {
    const { updated } = await recordHoldTime({
      conversationId,
      estimatedMinutes: Math.round(minutes),
    });
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    console.error("[pdl-dialer] hold-time update failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
