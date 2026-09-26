import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, conversations, messages } from "@/db/schema";
import { candidateSendMessageAction } from "@/actions/candidate";
import { CompanyVerificationBadge } from "@/components/badges";
import { MessageComposer } from "@/components/message-composer";
import { MessageThread } from "@/components/message-thread";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui";
import { requireCandidate } from "@/server/auth";

export const metadata: Metadata = { title: "Conversation" };

export default async function CandidateConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { candidate } = await requireCandidate();
  const [row] = await db
    .select({ conversation: conversations, company: companies })
    .from(conversations)
    .innerJoin(companies, eq(companies.id, conversations.companyId))
    .where(and(eq(conversations.id, id), eq(conversations.candidateId, candidate.id)))
    .limit(1);
  if (!row) notFound();
  // Opening the thread marks the company's messages as read.
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, id), eq(messages.senderRole, "company"), isNull(messages.readAt)));
  const thread = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={row.company.name}
        back={{ href: "/candidate/messages", label: "Messages" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {row.conversation.subject} <CompanyVerificationBadge status={row.company.verificationStatus} /> <span className="font-mono text-xs">{row.company.maskedEmail}</span>
          </span>
        }
      />
      <Card>
        <CardBody>
          <MessageThread messages={thread} viewer="candidate" names={{ company: row.company.name, candidate: "You" }} />
        </CardBody>
      </Card>
      {row.conversation.status === "open" ? (
        <Card>
          <CardBody>
            <MessageComposer action={candidateSendMessageAction.bind(null, id)} />
          </CardBody>
        </Card>
      ) : (
        <Alert tone="warn" title="This conversation was closed by platform moderation." />
      )}
    </div>
  );
}
