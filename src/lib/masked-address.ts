// Platform-generated relay addresses (README §6): hr@xyz.com is never shown to candidates;
// they write to hr_53543@panel.com and the platform routes the message.

import { randomInt } from "node:crypto";

export type MaskedKind = "hr" | "candidate";

export function relayDomain(): string {
  return (process.env.RELAY_DOMAIN ?? "panel.com").toLowerCase();
}

export function makeMaskedAddress(kind: MaskedKind, rand: () => number = () => randomInt(10000, 100000)): string {
  return `${kind}_${rand()}@${relayDomain()}`;
}

export function parseMaskedAddress(address: string): { kind: MaskedKind; code: string } | null {
  const m = /^\s*(?:.*<)?(hr|candidate)_(\d{5,})@([a-z0-9.-]+)>?\s*$/i.exec(address);
  if (!m) return null;
  if (m[3]!.toLowerCase() !== relayDomain()) return null;
  return { kind: m[1]!.toLowerCase() as MaskedKind, code: m[2]! };
}

/** Extract the bare address from "Name <addr@host>" forms. */
export function bareAddress(address: string): string {
  const m = /<([^>]+)>/.exec(address);
  return (m ? m[1]! : address).trim().toLowerCase();
}
