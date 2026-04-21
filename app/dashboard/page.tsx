import { hasDb, listRecentCalls } from "@/lib/db";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasDb()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-header">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Database is not configured. Set <code>DATABASE_URL</code> to enable.
          </p>
        </div>
      </main>
    );
  }

  const initial = await listRecentCalls(50).catch(() => []);
  return <DashboardClient initialCalls={initial} />;
}
