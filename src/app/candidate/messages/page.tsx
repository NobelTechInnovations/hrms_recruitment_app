import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, conversations, messages } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireCandidate } from "@/server/auth";

export const metadata: Metadata = { title: "Messages" };

export default async function CandidateMessagesPage() {
  const { candidate } = await requireCandidate();
  const rows = await db
    .select({
      conversation: conversations,
      company: companies,
      unread: sql<number>`(select count(*) from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.senderRole} = 'company' and ${messages.readAt} is null)`,
      last: sql<string | null>`(select ${messages.body} from ${messages} where ${messages.conversationId} = ${conversations.id} order by ${messages.createdAt} desc limit 1)`,
    })
    .from(conversations)
    .innerJoin(companies, eq(companies.id, conversations.companyId))
    .where(eq(conversations.candidateId, candidate.id))
    .orderBy(desc(conversations.lastMessageAt));
  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description={<>Companies see you as <span className="font-mono">{candidate.maskedEmail}</span>. You can also reply from your email — replies are routed through the platform.</>} />
      {rows.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map(({ conversation, company, unread, last }) => (
              <li key={conversation.id}>
                <Link href={`/candidate/messages/${conversation.id}`} className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-subtle">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {company.name} <span className="font-normal text-ink-2">· {conversation.subject}</span>
                    </p>
                    <p className="truncate text-sm text-ink-2">{last ?? "No messages yet"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-ink-3">{timeAgo(conversation.lastMessageAt ?? conversation.createdAt)}</span>
                    {Number(unread) > 0 ? <Badge tone="accent">{unread} new</Badge> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="No conversations yet" description="Companies will message you here about your applications." />
      )}
    </div>
  );
}
