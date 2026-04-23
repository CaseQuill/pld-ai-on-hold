"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CallRow } from "@/lib/db";

type Props = { initialCalls: CallRow[] };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-brand-light text-brand border border-brand/20",
  transferred: "bg-green-50 text-green-700 border border-green-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
};

function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalSecs = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default function DashboardClient({ initialCalls }: Props) {
  const [calls, setCalls] = useState<CallRow[]>(initialCalls);
  const [, setTick] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/calls", { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; calls?: CallRow[] };
        if (data.ok && data.calls && mounted.current) {
          setCalls(data.calls);
        }
      } catch {}
    }
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {}
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex items-center gap-2">
            <Image src="/finch-logo.svg" alt="Finch" width={26} height={21} priority />
            <span className="text-header font-semibold text-lg tracking-tight">Finch</span>
          </div>
          <span className="text-neutral-400 text-sm font-medium">×</span>
          <Image
            src="/pond-lehocky-logo.png"
            alt="Pond Lehocky"
            width={228}
            height={18}
            priority
            className="h-[18px] w-auto"
          />
        </div>

        <div className="bg-white border border-divider rounded-md shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-header tracking-tight">
                Call history
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Showing the latest {calls.length} call{calls.length === 1 ? "" : "s"}.
              </p>
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-brand hover:text-brand-dark transition-colors"
            >
              New call →
            </Link>
          </div>

          {calls.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-500">
              No calls yet.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 sm:-mx-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 border-b border-divider">
                    <th className="font-medium px-6 sm:px-8 py-2.5">Started</th>
                    <th className="font-medium px-4 py-2.5">Duration</th>
                    <th className="font-medium px-4 py-2.5">Number</th>
                    <th className="font-medium px-4 py-2.5">Status</th>
                    <th className="font-medium px-4 py-2.5">Conversation ID</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => {
                    const statusKey = c.status.toLowerCase();
                    const badge =
                      STATUS_STYLES[statusKey] ??
                      "bg-neutral-100 text-neutral-700 border border-neutral-200";
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-divider last:border-b-0 hover:bg-surface-subtle transition-colors"
                      >
                        <td className="px-6 sm:px-8 py-3 text-neutral-700 whitespace-nowrap">
                          {formatLocalTime(c.fired_at)}
                        </td>
                        <td className="px-4 py-3 text-neutral-700 font-mono text-xs whitespace-nowrap tabular-nums">
                          {formatDuration(c.fired_at, c.ended_at)}
                          {c.status === "active" && (
                            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse align-middle" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-900 font-medium whitespace-nowrap">
                          {formatPhone(c.to_number)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${badge}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => copyId(c.conversation_id)}
                            className="hover:text-brand transition-colors"
                            title="Copy conversation ID"
                          >
                            {copiedId === c.conversation_id
                              ? "Copied!"
                              : `${c.conversation_id.slice(0, 22)}...`}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-neutral-500">
          Powered by Finch
        </footer>
      </div>
    </main>
  );
}
