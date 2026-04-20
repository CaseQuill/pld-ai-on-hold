import { NextRequest, NextResponse } from "next/server";
import { normalizeUsCaPhone } from "@/lib/phone";
import {
  globalDailyLimiter,
  nextPhnumId,
  perIpLimiter,
} from "@/lib/ratelimit";
import { fireElevenLabsCall } from "@/lib/elevenlabs";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  let body: { to?: unknown };
  try {
    body = (await req.json()) as { to?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const phone = normalizeUsCaPhone(String(body.to ?? ""));
  if (!phone.ok) {
    return NextResponse.json({ ok: false, error: phone.error }, { status: 400 });
  }

  const ip = getClientIp(req);
  const ipLimit = await perIpLimiter.limit(ip);
  if (!ipLimit.success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const globalLimit = await globalDailyLimiter.limit("all");
  if (!globalLimit.success) {
    return NextResponse.json(
      { ok: false, error: "Daily call limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  const pool = (process.env.EL_PHNUM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (pool.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Server misconfigured: no phone numbers available" },
      { status: 500 }
    );
  }

  const phnumId = await nextPhnumId(pool);

  const result = await fireElevenLabsCall({
    toNumber: phone.e164,
    phnumId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: `ElevenLabs error: ${result.error}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    conversationId: result.conversationId,
    to: phone.e164,
  });
}
