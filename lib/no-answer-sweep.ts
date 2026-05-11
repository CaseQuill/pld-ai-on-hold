import { getSql } from "./db";

// For active rows older than this, query EL to see if the call ever
// connected. If EL has settled the conversation with zero duration we
// mark our row as no_answer.
const STUCK_AFTER_SECS = 30;
const MAX_PER_SWEEP = 20;

type ElConversation = {
  status?: string;
  metadata?: {
    call_duration_secs?: number;
    start_time_unix_secs?: number;
  };
};

export async function sweepStuckCalls(): Promise<{ marked: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { marked: 0 };
  const sql = getSql();

  const rows = (await sql`
    select conversation_id from calls
    where status = 'active'
      and fired_at < now() - interval '30 seconds'
    order by fired_at asc
    limit ${MAX_PER_SWEEP}
  `) as unknown as Array<{ conversation_id: string }>;

  let marked = 0;
  for (const row of rows) {
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${row.conversation_id}`,
        { headers: { "xi-api-key": apiKey }, cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as ElConversation;
      const status = data.status ?? "";
      const duration = data.metadata?.call_duration_secs ?? 0;
      const startSecs = data.metadata?.start_time_unix_secs ?? 0;
      const ageSecs = Date.now() / 1000 - startSecs;

      const settled = status !== "in-progress" && status !== "processing";
      const neverConnected = duration === 0 && ageSecs > STUCK_AFTER_SECS;

      if (settled && neverConnected) {
        const updated = (await sql`
          update calls
          set status = 'no_answer',
              ended_at = now(),
              end_reason = 'No answer'
          where conversation_id = ${row.conversation_id}
            and status = 'active'
          returning id
        `) as unknown as Array<{ id: string }>;
        if (updated.length > 0) marked += 1;
      }
    } catch (err) {
      console.error(
        "[pdl-dialer] no-answer sweep error for",
        row.conversation_id,
        err
      );
    }
  }

  return { marked };
}
