import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, conversations, jobs, messages } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireCompany } from "@/server/auth";

export const metadata: Metadata = { title: "Messages" };

export default async function CompanyMessagesPage() {
  const { company } = await requireCompany("messages.send");
  const rows = await db
    .select({
      conversation: conversations,
      candidate: candidates,
      jobTitle: jobs.title,
      unread: sql<number>`(select count(*) from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.senderRole} = 'candidate' and ${messages.readAt} is null)`,
      last: sql<string | null>`(select ${messages.body} from ${messages} where ${messages.conversationId} = ${conversations.id} order by ${messages.createdAt} desc limit 1)`,
    })
    .from(conversations)
    .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
    .leftJoin(jobs, eq(jobs.id, conversations.jobId))
    .where(eq(conversations.companyId, company.id))
    .orderBy(desc(conversations.lastMessageAt));
  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description={<>Candidates see you as <span className="font-mono">{company.maskedEmail}</span>. Replies to relay emails land here and in {company.businessEmail}.</>} />
      {rows.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map(({ conversation, candidate, jobTitle, unread, last }) => (
              <li key={conversation.id}>
                <Link href={`/company/messages/${conversation.id}`} className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-subtle">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {candidate.fullName} <span className="font-normal text-ink-2">· {jobTitle ?? conversation.subject}</span>
                    </p>
                    <p className="truncate text-sm text-ink-2">{last ?? "No messages yet"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-ink-3">{timeAgo(conversation.lastMessageAt ?? conversation.createdAt)}</span>
                    {Number(unread) > 0 ? <Badge tone="accent">{unread} new</Badge> : null}
                    {conversation.status !== "open" ? <Badge tone="bad">Closed</Badge> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="No conversations yet" description="Message candidates from their application or profile." />
      )}
    </div>
  );
}
