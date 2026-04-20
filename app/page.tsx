"use client";

import Image from "next/image";
import { useState } from "react";

type Toast = { kind: "success" | "error"; message: string } | null;

export default function Home() {
  const [to, setTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setToast(null);

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        to?: string;
      };

      if (data.ok) {
        setToast({ kind: "success", message: `Call initiated to ${data.to}` });
        setTo("");
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex items-center gap-2">
            <Image
              src="/finch-logo.svg"
              alt="Finch"
              width={26}
              height={21}
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

        <div className="bg-white border border-divider rounded-md shadow-sm p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-header tracking-tight">
              AI on Hold
            </h1>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Start a call to SSA. Our AI navigates the IVR, waits on hold, and
              transfers the call to you when a representative picks up.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="to"
                className="block text-sm font-medium text-neutral-700 mb-1.5"
              >
                Phone number
              </label>
              <input
                id="to"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(555) 123-4567"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={submitting}
                className="w-full h-10 rounded-md bg-white border border-divider px-3 text-sm text-neutral-900 placeholder-neutral-400 shadow-xs transition focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !to.trim()}
              className="w-full h-10 rounded-md bg-brand hover:bg-brand-dark text-white text-sm font-medium shadow-sm transition-colors disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Initiating call..." : "Initiate call"}
            </button>
          </form>

          {toast && (
            <div
              role="status"
              className={`mt-5 rounded-md px-4 py-3 text-sm border ${
                toast.kind === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {toast.message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
