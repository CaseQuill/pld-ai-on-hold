"use client";

import Image from "next/image";
import { AsYouType } from "libphonenumber-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CallRow } from "@/lib/db";

type Toast = { kind: "success" | "error"; message: string } | null;
type Props = {
  initialCalls: CallRow[];
  dbAvailable: boolean;
  showConversationId?: boolean;
  showClaim?: boolean;
  showDemoRows?: boolean;
  disableSubmit?: boolean;
};

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  active: "bg-brand-light text-brand border border-brand/20",
  transferred: "bg-green-50 text-green-700 border border-green-200",
  failed: "bg-orange-50 text-orange-700 border border-orange-200",
  no_answer: "bg-neutral-100 text-neutral-700 border border-neutral-300",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  transferred: "Transferred",
  failed: "Completed",
  no_answer: "No Answer",
};

function formatUsPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  return new AsYouType("US").input(digits);
}

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

function formatHoldCountdown(
  reportedAtIso: string | null,
  estimatedMinutes: number | null,
  isActive: boolean
): string {
  if (estimatedMinutes == null) return "";
  if (!isActive || !reportedAtIso) return `~ ${estimatedMinutes}m`;
  const reportedAt = new Date(reportedAtIso).getTime();
  const targetMs = reportedAt + estimatedMinutes * 60_000;
  const remaining = targetMs - Date.now();
  if (remaining <= 0) return "~ due";
  const totalSecs = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (minutes > 0) return `~ ${minutes}m ${secs}s`;
  return `~ ${secs}s`;
}

const RECENT_END_WINDOW_MS = 3 * 60 * 1000;
const RECENT_TRANSFER_WINDOW_MS = 120 * 1000;

function pinTier(c: CallRow, now: number): number {
  if (c.status === "active") return 0;
  if (c.ended_at && now - new Date(c.ended_at).getTime() < RECENT_END_WINDOW_MS) {
    return 1;
  }
  return 2;
}

function isRecentlyTransferred(c: CallRow, now: number): boolean {
  return (
    c.status === "transferred" &&
    !!c.ended_at &&
    now - new Date(c.ended_at).getTime() < RECENT_TRANSFER_WINDOW_MS
  );
}

function buildClaimDemoRows(claimed: Set<string>): CallRow[] {
  const now = Date.now();
  return [
    {
      id: "demo-unclaimed",
      conversation_id: "demo_unclaimed",
      to_number: "+13473748921",
      phnum_id: "demo",
      status: "transferred",
      fired_at: new Date(now - 5 * 60 * 1000).toISOString(),
      ended_at: new Date(now - 30 * 1000).toISOString(),
      end_reason: null,
      estimated_hold_minutes: 5,
      hold_minutes_reported_at: new Date(now - 4 * 60 * 1000).toISOString(),
      matter_id: "7c8e2a91-4f3b-4d6a-9e1d-3a5c8b2f4d7e",
      claimed_at: claimed.has("demo_unclaimed")
        ? new Date(now - 5 * 1000).toISOString()
        : null,
    },
    {
      id: "demo-claimed",
      conversation_id: "demo_claimed",
      to_number: "+13473748921",
      phnum_id: "demo",
      status: "transferred",
      fired_at: new Date(now - 10 * 60 * 1000).toISOString(),
      ended_at: new Date(now - 90 * 1000).toISOString(),
      end_reason: null,
      estimated_hold_minutes: null,
      hold_minutes_reported_at: null,
      matter_id: "a4b2c1d9-3e8f-4b7a-8c5d-1f9e6a3b7c2d",
      claimed_at: new Date(now - 30 * 1000).toISOString(),
    },
    {
      id: "demo-no-answer",
      conversation_id: "demo_no_answer",
      to_number: "+13473748921",
      phnum_id: "demo",
      status: "no_answer",
      fired_at: new Date(now - 6 * 60 * 1000).toISOString(),
      ended_at: new Date(now - 5 * 60 * 1000 - 30 * 1000).toISOString(),
      end_reason: "No answer",
      estimated_hold_minutes: null,
      hold_minutes_reported_at: null,
      matter_id: "e1c4d2b7-9a3f-4e8c-b1d6-7f2a4c8e9b3d",
      claimed_at: null,
    },
  ];
}

function isDemoRow(c: CallRow): boolean {
  return c.conversation_id.startsWith("demo_");
}

function sortCalls(calls: CallRow[], claimAware: boolean): CallRow[] {
  const now = Date.now();
  return [...calls].sort((a, b) => {
    const ta = pinTier(a, now);
    const tb = pinTier(b, now);
    if (ta !== tb) return ta - tb;
    if (ta === 1 && a.ended_at && b.ended_at) {
      if (claimAware) {
        const aClaimed = a.claimed_at ? 1 : 0;
        const bClaimed = b.claimed_at ? 1 : 0;
        if (aClaimed !== bClaimed) return aClaimed - bClaimed;
      }
      return new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime();
    }
    return new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime();
  });
}

export default function HomeClient({
  initialCalls,
  dbAvailable,
  showConversationId = false,
  showClaim = false,
  showDemoRows = false,
  disableSubmit = false,
}: Props) {
  const [to, setTo] = useState("");
  const [matter, setMatter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [calls, setCalls] = useState<CallRow[]>(initialCalls);
  const [demoClaimed, setDemoClaimed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [, setTick] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mounted = useRef(true);

  const refreshHistory = useCallback(async () => {
    if (!dbAvailable) return;
    try {
      const res = await fetch("/api/calls", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; calls?: CallRow[] };
      if (data.ok && data.calls && mounted.current) {
        setCalls(data.calls);
      }
    } catch {}
  }, [dbAvailable]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dbAvailable) return;
    const id = setInterval(refreshHistory, 5000);
    return () => clearInterval(id);
  }, [dbAvailable, refreshHistory]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setToast(null);

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, matter: matter.trim() || undefined }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        to?: string;
      };

      if (data.ok) {
        setToast({ kind: "success", message: `Call initiated to ${data.to}` });
        setTo("");
        setMatter("");
        setPage(0);
        refreshHistory();
      } else {
        setToast({ kind: "error", message: data.error ?? "Something went wrong" });
      }
    } catch {
      setToast({ kind: "error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {}
  }

  async function onClaim(conversationId: string) {
    if (conversationId.startsWith("demo_")) {
      setDemoClaimed((prev) => {
        const next = new Set(prev);
        next.add(conversationId);
        return next;
      });
      return;
    }
    const nowIso = new Date().toISOString();
    setCalls((prev) =>
      prev.map((c) =>
        c.conversation_id === conversationId ? { ...c, claimed_at: nowIso } : c
      )
    );
    try {
      const res = await fetch("/api/calls/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      if (!res.ok) throw new Error("claim failed");
    } catch {
      setCalls((prev) =>
        prev.map((c) =>
          c.conversation_id === conversationId ? { ...c, claimed_at: null } : c
        )
      );
      setToast({ kind: "error", message: "Could not claim call. Try again." });
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-28 pb-12">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <Image
              src="/finch-bird.png"
              alt="Finch"
              width={24}
              height={24}
              priority
            />
            <span className="text-header font-semibold text-lg tracking-tight">
              Finch
            </span>
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

        <div className="bg-white border border-divider rounded-md shadow-sm p-6 sm:p-8 mb-6">
          <div className="text-center mb-5">
            <h1 className="text-2xl font-semibold text-header tracking-tight">
              AI on Hold
            </h1>
            <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed max-w-lg mx-auto">
              Start a call to SSA. Our AI navigates the IVR, waits on hold, and
              transfers the call to you when a representative picks up.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex flex-col items-center gap-3 max-w-xl mx-auto"
          >
            <input
              id="to"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="(555) 123-4567"
              value={to}
              onChange={(e) => setTo(formatUsPhone(e.target.value))}
              disabled={submitting}
              aria-label="SSA office number"
              className="w-full max-w-xs h-10 rounded-md bg-white border border-divider px-3 text-sm text-neutral-900 placeholder-neutral-400 shadow-xs transition focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <input
              id="matter"
              type="text"
              autoComplete="off"
              placeholder="Matter ID"
              value={matter}
              onChange={(e) => setMatter(e.target.value)}
              disabled={submitting}
              maxLength={100}
              required
              aria-label="Matter ID"
              className="w-full max-w-xs h-10 rounded-md bg-white border border-divider px-3 text-sm text-neutral-900 placeholder-neutral-400 shadow-xs transition focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={submitting || !to.trim() || !matter.trim() || disableSubmit}
              className="h-10 px-8 rounded-md bg-brand hover:bg-brand-dark text-white text-sm font-medium shadow-sm transition-colors disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-flex items-center">
                  Dialing
                  <span className="inline-flex ml-0.5 w-5 justify-start">
                    <span className="dot-anim">.</span>
                    <span className="dot-anim" style={{ animationDelay: "0.2s" }}>.</span>
                    <span className="dot-anim" style={{ animationDelay: "0.4s" }}>.</span>
                  </span>
                </span>
              ) : (
                "Initiate call"
              )}
            </button>
          </form>

          {toast && (
            <div
              role="status"
              className={`mt-4 mx-auto max-w-xl rounded-md px-4 py-3 text-sm border ${
                toast.kind === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {toast.message}
            </div>
          )}

        </div>

        {(() => {
          const sorted = sortCalls(calls, showClaim);
          const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
          const safePage = Math.min(page, totalPages - 1);
          const start = safePage * PAGE_SIZE;
          const end = Math.min(start + PAGE_SIZE, sorted.length);
          const realVisible = sorted.slice(start, end);
          const demoRows = showDemoRows ? buildClaimDemoRows(demoClaimed) : [];
          const visible = [...demoRows, ...realVisible];
          return (
            <div className="bg-white border border-divider rounded-md shadow-sm p-6 sm:p-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-header tracking-tight">
                  Call history
                </h2>
                {dbAvailable && sorted.length > 0 && (
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Showing {start + 1}–{end} of {sorted.length} call
                    {sorted.length === 1 ? "" : "s"}.
                  </p>
                )}
              </div>

              {!dbAvailable ? (
                <div className="py-10 text-center text-sm text-neutral-500">
                  Database is not configured. Set <code>DATABASE_URL</code> to enable.
                </div>
              ) : calls.length === 0 && !showDemoRows ? (
                <div className="py-10 text-center text-sm text-neutral-500">
                  No calls yet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-6 sm:-mx-8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 border-b border-divider">
                          <th className="font-medium px-6 sm:px-8 py-2.5">Started</th>
                          <th className="font-medium px-4 py-2.5">Duration</th>
                          <th
                            className="font-medium px-4 py-2.5"
                            title="Estimated wait time as announced by SSA. Estimate only."
                          >
                            Est. hold
                          </th>
                          <th className="font-medium px-4 py-2.5">Number</th>
                          <th className="font-medium px-4 py-2.5">Matter ID</th>
                          <th className="font-medium px-4 py-2.5">Status</th>
                          {showConversationId && (
                            <th className="font-medium px-4 py-2.5">Conversation ID</th>
                          )}
                          {showClaim && (
                            <th className="font-medium px-4 py-2.5">Claim</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((c) => {
                          const statusKey = c.status.toLowerCase();
                          const justTransferred = isRecentlyTransferred(c, Date.now());
                          const badge = justTransferred
                            ? "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse"
                            : STATUS_STYLES[statusKey] ??
                              "bg-neutral-100 text-neutral-700 border border-neutral-200";
                          const statusLabel = justTransferred
                            ? "Just transferred"
                            : STATUS_LABELS[statusKey] ?? c.status;
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
                              <td className="px-4 py-3 text-neutral-700 font-mono text-xs whitespace-nowrap tabular-nums">
                                {formatHoldCountdown(
                                  c.hold_minutes_reported_at,
                                  c.estimated_hold_minutes,
                                  c.status === "active"
                                )}
                              </td>
                              <td className="px-4 py-3 text-neutral-900 font-medium whitespace-nowrap">
                                {formatPhone(c.to_number)}
                              </td>
                              <td
                                className="px-4 py-3 text-neutral-700 font-mono text-xs max-w-[180px] truncate"
                                title={c.matter_id ?? undefined}
                              >
                                {c.matter_id ?? ""}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              {showConversationId && (
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
                              )}
                              {showClaim && (
                                <td className="px-4 py-3">
                                  {c.claimed_at ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                      <span aria-hidden>✓</span> Claimed
                                    </span>
                                  ) : c.status === "transferred" &&
                                    c.ended_at &&
                                    Date.now() -
                                      new Date(c.ended_at).getTime() <
                                      RECENT_END_WINDOW_MS ? (
                                    <button
                                      type="button"
                                      onClick={() => onClaim(c.conversation_id)}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-brand text-brand hover:bg-brand hover:text-white transition-colors"
                                    >
                                      Claim
                                    </button>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-divider">
                      <span className="text-xs text-neutral-500">
                        Page {safePage + 1} of {totalPages}
                      </span>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={safePage === 0}
                          className="text-sm font-medium text-brand hover:text-brand-dark disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={safePage >= totalPages - 1}
                          className="text-sm font-medium text-brand hover:text-brand-dark disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        <footer className="mt-6 text-center text-xs text-neutral-500">
          Powered by Finch
        </footer>
      </div>
    </main>
  );
}
