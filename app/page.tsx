import { hasDb, listRecentCalls } from "@/lib/db";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dbAvailable = hasDb();
  const initialCalls = dbAvailable
    ? await listRecentCalls(50).catch(() => [])
    : [];

  return <HomeClient initialCalls={initialCalls} dbAvailable={dbAvailable} />;
}
