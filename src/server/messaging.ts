// Privacy-protected communication (README §6):
//   Candidate → Panel → Company   and   Company → Panel → Candidate
// Neither side ever sees the other's real email or phone number.

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, companies, companyMembers, conversations, mailRelayLog, messages, users, type Candidate, type Company, type Conversation } from "@/db/schema";
import { scanMessage } from "@/lib/contact-guard";
import { bareAddress, parseMaskedAddress } from "@/lib/masked-address";
import { appUrl, notify, notifyCompany, sendEmail } from "./notify";
import { UserError } from "@/lib/errors";

export class MessagingError extends UserError {}

export async function hasApplied(companyId: string, candidateId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.companyId, companyId), eq(applications.candidateId, candidateId)))
    .limit(1);
  return !!row;
}

/** Companies may contact candidates who applied to them, or who opted in to recruiter contact. */
export async function canCompanyContact(company: Company, candidate: Candidate): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (await hasApplied(company.id, candidate.id)) return { ok: true };
  if (company.verificationStatus !== "verified") return { ok: false, reason: "Only verified companies can contact candidates who haven't applied." };
  if (!candidate.allowRecruiterContact || candidate.profileVisibility !== "all_verified") {
    return { ok: false, reason: "This candidate only accepts messages about jobs they have applied to." };
  }
  return { ok: true };
}

export async function getOrCreateConversation(input: { companyId: string; candidateId: string; jobId?: string | null; applicationId?: string | null; subject: string }): Promise<Conversation> {
  const jobCond = input.jobId ? eq(conversations.jobId, input.jobId) : isNull(conversations.jobId);
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.companyId, input.companyId), eq(conversations.candidateId, input.candidateId), jobCond))
    .limit(1);
  if (existing) return existing;
  const [conv] = await db
    .insert(conversations)
    .values({ companyId: input.companyId, candidateId: input.candidateId, jobId: input.jobId ?? null, applicationId: input.applicationId ?? null, subject: input.subject })
    .returning();
  return conv!;
}

async function conversationParties(conversationId: string) {
  const [row] = await db
    .select({ conversation: conversations, company: companies, candidate: candidates, candidateEmail: users.email })
    .from(conversations)
    .innerJoin(companies, eq(companies.id, conversations.companyId))
    .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
    .innerJoin(users, eq(users.id, candidates.userId))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ?? null;
}

export async function postMessage(input: {
  conversationId: string;
  senderRole: "company" | "candidate";
  senderUserId: string;
  body: string;
  channel?: "in_app" | "email";
}) {
  const parties = await conversationParties(input.conversationId);
  if (!parties) throw new MessagingError("Conversation not found.");
  const { conversation, company, candidate, candidateEmail } = parties;
  if (conversation.status !== "open") throw new MessagingError("This conversation has been closed by the platform.");
  const body = input.body.trim();
  if (!body) throw new MessagingError("Message cannot be empty.");
  if (body.length > 5000) throw new MessagingError("Message is too long (5,000 characters max).");

  const guard = scanMessage(body);
  const fromCompany = input.senderRole === "company";
  const fromAddress = fromCompany ? company.maskedEmail : candidate.maskedEmail;
  const toAddress = fromCompany ? candidate.maskedEmail : company.maskedEmail;

  const [message] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      senderRole: input.senderRole,
      senderUserId: input.senderUserId,
      fromAddress,
      toAddress,
      body: guard.redacted,
      originalBody: guard.flagged ? body : null,
      flagged: guard.flagged,
      flagReasons: guard.reasons,
      moderationStatus: guard.flagged ? "pending_review" : "none",
      channel: input.channel ?? "in_app",
    })
    .returning();
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversation.id));
  if (guard.flagged) {
    await db
      .update(users)
      .set({ violationCount: sql`${users.violationCount} + 1` })
      .where(eq(users.id, input.senderUserId));
  }

  // Relay to the recipient's real inbox, from the sender's masked address.
  const realRecipient = fromCompany ? candidateEmail : company.businessEmail;
  const senderName = fromCompany ? company.name : candidate.fullName;
  const link = fromCompany ? `/candidate/messages/${conversation.id}` : `/company/messages/${conversation.id}`;
  const result = await sendEmail({
    to: realRecipient,
    from: `${senderName} via HRMS Talent <${fromAddress}>`,
    replyTo: fromAddress,
    subject: `Re: ${conversation.subject}`,
    text: `${guard.redacted}\n\n—\nReply to this email or open the conversation: ${appUrl(link)}\nYour contact details are protected — replies are routed through ${fromAddress.split("@")[1]}.`,
  });
  await db.insert(mailRelayLog).values({
    messageId: message!.id,
    direction: "outbound",
    maskedFrom: fromAddress,
    maskedTo: toAddress,
    realRecipient,
    subject: conversation.subject,
    status: result.status === "sent" ? "delivered" : result.status === "failed" ? "failed" : "logged",
    error: result.error ?? null,
  });

  const payload = { type: "message", title: `New message from ${senderName}`, body: guard.redacted.slice(0, 140), link };
  if (fromCompany) await notify(candidate.userId, payload, { inAppOnly: true });
  else await notifyCompany(company.id, payload, "messages.send", { inAppOnly: true });

  return { message: message!, guard };
}

function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^—\s*$/.test(line)) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Inbound email webhook: someone replied to a masked address from their real mailbox.
 * The sender must be the verified counter-party of an existing relationship.
 */
export async function routeInboundEmail(mail: { from: string; to: string; subject?: string; text: string }) {
  const target = parseMaskedAddress(mail.to);
  const sender = bareAddress(mail.from);
  const log = async (status: "delivered" | "rejected", error?: string, messageId?: string) =>
    db.insert(mailRelayLog).values({ messageId: messageId ?? null, direction: "inbound", maskedFrom: sender, maskedTo: mail.to, realRecipient: null, subject: mail.subject ?? null, status, error: error ?? null });

  if (!target) {
    await log("rejected", "Unknown relay address");
    return { ok: false as const, error: "Unknown relay address" };
  }

  let company: Company | undefined;
  let candidate: Candidate | undefined;
  let senderUserId: string | undefined;
  let senderRole: "company" | "candidate";

  if (target.kind === "hr") {
    [company] = await db.select().from(companies).where(eq(companies.maskedEmail, bareAddress(mail.to))).limit(1);
    const [row] = await db.select({ candidate: candidates }).from(users).innerJoin(candidates, eq(candidates.userId, users.id)).where(eq(users.email, sender)).limit(1);
    candidate = row?.candidate;
    senderUserId = candidate?.userId;
    senderRole = "candidate";
  } else {
    [candidate] = await db.select().from(candidates).where(eq(candidates.maskedEmail, bareAddress(mail.to))).limit(1);
    const [member] = await db
      .select({ company: companies, userId: users.id })
      .from(users)
      .innerJoin(companyMembers, eq(companyMembers.userId, users.id))
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(eq(users.email, sender))
      .limit(1);
    if (member) {
      company = member.company;
      senderUserId = member.userId;
    } else {
      [company] = await db.select().from(companies).where(eq(companies.businessEmail, sender)).limit(1);
      senderUserId = company?.ownerUserId;
    }
    senderRole = "company";
  }

  if (!company || !candidate || !senderUserId) {
    await log("rejected", "Sender is not a participant");
    return { ok: false as const, error: "Sender is not a participant" };
  }

  let [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.companyId, company.id), eq(conversations.candidateId, candidate.id)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  if (!conversation) {
    const allowed = senderRole === "company" ? (await canCompanyContact(company, candidate)).ok : await hasApplied(company.id, candidate.id);
    if (!allowed) {
      await log("rejected", "No relationship between sender and recipient");
      return { ok: false as const, error: "No relationship between sender and recipient" };
    }
    conversation = await getOrCreateConversation({ companyId: company.id, candidateId: candidate.id, subject: mail.subject?.replace(/^(re|fwd?):\s*/i, "") || "Message" });
  }

  const body = stripQuotedReply(mail.text);
  try {
    const { message } = await postMessage({ conversationId: conversation.id, senderRole, senderUserId, body, channel: "email" });
    await log("delivered", undefined, message.id);
    return { ok: true as const, conversationId: conversation.id, messageId: message.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Delivery failed";
    await log("rejected", error);
    return { ok: false as const, error };
  }
}
