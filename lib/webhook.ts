import crypto from "crypto";
import type { CallStatus } from "@/lib/db";

export function verifyElSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>(
    (acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    },
    {}
  );

  const timestamp = parts.t;
  const provided = parts.v0;
  if (!timestamp || !provided) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

type ElTranscriptMessage = {
  role?: string;
  message?: string | null;
  tool_calls?: Array<{
    tool_name?: string;
    type?: string;
  }>;
};

type ElWebhookData = {
  conversation_id?: string;
  status?: string;
  transcript?: ElTranscriptMessage[];
  metadata?: {
    call_duration_secs?: number;
    termination_reason?: string;
  };
  analysis?: {
    call_successful?: string;
    data_collection_results?: Record<string, unknown>;
  };
  features_usage?: {
    transfer_to_number?: { used?: boolean };
  };
};

export type TransferInference = {
  status: CallStatus;
  reason: string;
};

export function inferFinalStatus(data: ElWebhookData): TransferInference {
  const featureFlag =
    data.features_usage?.transfer_to_number?.used === true;
  if (featureFlag) {
    return { status: "transferred", reason: "features_usage.transfer_to_number.used" };
  }

  const toolTransfer = (data.transcript ?? []).some((msg) =>
    (msg.tool_calls ?? []).some((tc) => {
      const name = (tc.tool_name ?? "").toLowerCase();
      const type = (tc.type ?? "").toLowerCase();
      return /transfer|phone_number/.test(name) || /transfer|phone_number/.test(type);
    })
  );
  if (toolTransfer) {
    return { status: "transferred", reason: "transcript.tool_calls.transfer" };
  }

  const termination = data.metadata?.termination_reason ?? "";
  if (/transfer/i.test(termination)) {
    return { status: "transferred", reason: `termination_reason:${termination}` };
  }

  return {
    status: "failed",
    reason: termination || data.analysis?.call_successful || "no_transfer_signal",
  };
}
