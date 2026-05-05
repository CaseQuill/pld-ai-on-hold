import { hasDb, listRecentCalls } from "@/lib/db";
import EstClient from "./est-client";

export const dynamic = "force-dynamic";

export default async function EstPage() {
  const dbAvailable = hasDb();
  const initialCalls = dbAvailable
    ? await listRecentCalls(50).catch(() => [])
    : [];

  return <EstClient initialCalls={initialCalls} dbAvailable={dbAvailable} />;
}
