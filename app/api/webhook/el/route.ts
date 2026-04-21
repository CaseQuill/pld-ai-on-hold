import { NextRequest, NextResponse } from "next/server";
import { hasDb, updateCallFinal } from "@/lib/db";
import { inferFinalStatus, verifyElSignature } from "@/lib/webhook";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.EL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[pdl-dialer] EL_WEBHOOK_SECRET not set");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("elevenlabs-signature");

  if (!verifyElSignature(rawBody, signature, secret)) {
    console.warn("[pdl-dialer] Rejected EL webhook: bad signature");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: { type?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "post_call_transcription") {
    return NextResponse.json({ ok: true, ignored: payload.type });
  }

  const data = (payload.data ?? {}) as Parameters<typeof inferFinalStatus>[0] & {
    conversation_id?: string;
  };
  const conversationId = data.conversation_id;
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "Missing conversation_id" }, { status: 400 });
  }

  const inference = inferFinalStatus(data);

  if (hasDb()) {
    try {
      await updateCallFinal({
        conversationId,
        status: inference.status,
        endReason: inference.reason,
      });
    } catch (err) {
      console.error("[pdl-dialer] DB update failed:", err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, conversationId, status: inference.status });
}
