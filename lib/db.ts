import { neon } from "@neondatabase/serverless";

export type CallStatus = "active" | "transferred" | "failed";

export type CallRow = {
  id: string;
  conversation_id: string;
  to_number: string;
  phnum_id: string;
  status: CallStatus;
  fired_at: string;
  ended_at: string | null;
  end_reason: string | null;
  estimated_hold_minutes: number | null;
  hold_minutes_reported_at: string | null;
};

let sqlClient: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (sqlClient) return sqlClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  sqlClient = neon(url);
  return sqlClient;
}

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

export async function insertCall(args: {
  conversationId: string;
  toNumber: string;
  phnumId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    insert into calls (conversation_id, to_number, phnum_id, status)
    values (${args.conversationId}, ${args.toNumber}, ${args.phnumId}, 'active')
    on conflict (conversation_id) do nothing
  `;
}

export async function updateCallFinal(args: {
  conversationId: string;
  status: CallStatus;
  endReason: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    update calls
    set status = ${args.status},
        ended_at = now(),
        end_reason = ${args.endReason}
    where conversation_id = ${args.conversationId}
  `;
}

export async function listRecentCalls(limit = 50): Promise<CallRow[]> {
  const sql = getSql();
  const rows = await sql`
    select id, conversation_id, to_number, phnum_id, status,
           fired_at, ended_at, end_reason,
           estimated_hold_minutes, hold_minutes_reported_at
    from calls
    order by fired_at desc
    limit ${limit}
  `;
  return rows as unknown as CallRow[];
}

export async function recordHoldTime(args: {
  conversationId: string;
  estimatedMinutes: number;
}): Promise<{ updated: boolean }> {
  const sql = getSql();
  const rows = (await sql`
    update calls
    set estimated_hold_minutes = ${args.estimatedMinutes},
        hold_minutes_reported_at = now()
    where conversation_id = ${args.conversationId}
    returning id
  `) as unknown as Array<{ id: string }>;
  return { updated: rows.length > 0 };
}
