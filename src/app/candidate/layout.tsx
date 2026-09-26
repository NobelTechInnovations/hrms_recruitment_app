import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, recommendations } from "@/db/schema";
import { candidateNav } from "@/components/navs";
import { AppShell } from "@/components/shell";
import { requireCandidate } from "@/server/auth";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { user, candidate } = await requireCandidate();
  const [[unreadMsgs], [pendingRecs]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(conversations.candidateId, candidate.id), eq(messages.senderRole, "company"), isNull(messages.readAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(recommendations)
      .where(and(eq(recommendations.candidateId, candidate.id), eq(recommendations.status, "pending"))),
  ]);
  const nav = candidateNav({ messages: Number(unreadMsgs?.n ?? 0), recommendations: Number(pendingRecs?.n ?? 0) });
  return (
    <AppShell user={user} nav={nav} context={<>Your relay address: <span className="font-mono text-ink">{candidate.maskedEmail}</span></>}>
      {children}
    </AppShell>
  );
}
