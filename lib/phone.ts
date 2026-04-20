import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

export function normalizeUsCaPhone(raw: string): PhoneResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Phone number is required" };
  }

  const parsed =
    parsePhoneNumberFromString(raw, "US") ??
    parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw}`, "US");

  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: "Enter a valid 10-digit US or Canada number" };
  }

  if (parsed.country !== "US" && parsed.country !== "CA") {
    return { ok: false, error: "Only US and Canada numbers are allowed" };
  }

  return { ok: true, e164: parsed.number };
}
