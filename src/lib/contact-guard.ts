// Detects attempts to move a conversation off-platform (README §6): personal emails,
// phone numbers (including spelled-out digits), and messaging-app handles.
// Direct contact details are redacted before delivery; softer signals are flagged for review.

import { relayDomain } from "./masked-address";

export type LeakReason = "email" | "phone" | "spelled_number" | "messaging_link" | "messaging_app" | "contact_request";

export const LEAK_REASON_LABELS: Record<LeakReason, string> = {
  email: "Personal email address",
  phone: "Phone number",
  spelled_number: "Phone number written in words",
  messaging_link: "Messaging app link",
  messaging_app: "Mentions an off-platform messaging app",
  contact_request: "Asks to be contacted directly",
};

export type GuardResult = {
  flagged: boolean;
  reasons: LeakReason[];
  redacted: string;
  redactions: number;
};

export const REDACTION = "[contact details removed]";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// "john at gmail dot com", "john [at] gmail [dot] com", "john(at)gmail.com"
const OBFUSCATED_EMAIL_RES = [
  /\b[a-z0-9._%+-]{2,}\s*[([{]?\s*(?:at|@)\s*[)\]}]?\s*[a-z0-9-]{2,}\s*[([{]?\s*dot\s*[)\]}]?\s*[a-z]{2,6}\b/gi,
  /\b[a-z0-9._%+-]{2,}\s*[([{]\s*at\s*[)\]}]\s*[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi,
];
const PHONE_CANDIDATE_RE = /(?:\+|\b)\d[\d\s().-]{7,}\d\b/g;
const NUMBER_WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|double|triple)";
const SPELLED_RE = new RegExp(`\\b(?:${NUMBER_WORD}[\\s,.-]*){7,}`, "gi");
const MESSAGING_LINK_RE = /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|signal\.me)\/\S*/gi;
const MESSAGING_APP_RE = /\b(?:whats\s?app|telegram|signal app|viber|wechat|skype|imo app)\b/i;
const CONTACT_REQUEST_RE =
  /\b(?:call me|text me|ping me|reach me|contact me)\s+(?:at|on|directly)\b|\bmy (?:personal )?(?:number|phone|mobile|cell|email|e-mail|contact)\b|\bshare (?:your|ur) (?:number|phone|mobile|email)\b/i;

function isYearSequence(run: string): boolean {
  const groups = run.split(/[\s().-]+/).filter(Boolean);
  return groups.length > 1 && groups.every((g) => /^(?:19|20)\d{2}$/.test(g));
}

function isPhoneLike(run: string): boolean {
  const digits = run.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  if (isYearSequence(run)) return false;
  return true;
}

export function scanMessage(text: string, allowedDomain: string = relayDomain()): GuardResult {
  const reasons = new Set<LeakReason>();
  let redactions = 0;
  let out = text;

  const replace = (re: RegExp, reason: LeakReason, keep?: (m: string) => boolean) => {
    out = out.replace(re, (m) => {
      if (keep?.(m)) return m;
      reasons.add(reason);
      redactions++;
      return REDACTION;
    });
  };

  replace(MESSAGING_LINK_RE, "messaging_link");
  replace(EMAIL_RE, "email", (m) => m.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`));
  for (const re of OBFUSCATED_EMAIL_RES) replace(re, "email");
  replace(PHONE_CANDIDATE_RE, "phone", (m) => !isPhoneLike(m));
  replace(SPELLED_RE, "spelled_number");

  if (MESSAGING_APP_RE.test(out)) reasons.add("messaging_app");
  if (CONTACT_REQUEST_RE.test(out)) reasons.add("contact_request");

  return { flagged: reasons.size > 0, reasons: [...reasons], redacted: out, redactions };
}
