import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates, companies, conversations, messages } from "@/db/schema";
import { setConversationStatusAction } from "@/actions/admin";
import { ActionButton } from "@/components/forms";
import { MessageThread } from "@/components/message-thread";
import { Badge, Card, CardBody, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Conversation audit" };

export default async function AdminConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({ conversation: conversations, company: companies, candidate: candidates })
    .from(conversations)
    .innerJoin(companies, eq(companies.id, conversations.companyId))
    .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row) notFound();
  const thread = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={`${row.company.name} ↔ ${row.candidate.fullName}`}
        back={{ href: "/admin/communication?tab=conversations", label: "Conversations" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {row.conversation.subject} <Badge tone={row.conversation.status === "open" ? "good" : "bad"}>{row.conversation.status}</Badge>
            <span className="font-mono text-xs">
              {row.company.maskedEmail} ⇄ {row.candidate.maskedEmail}
            </span>
          </span>
        }
        actions={
          row.conversation.status === "open" ? (
            <ActionButton action={setConversationStatusAction.bind(null, id, "blocked")} variant="danger" size="md" confirm="Block this conversation?">
              Block conversation
            </ActionButton>
          ) : (
            <ActionButton action={setConversationStatusAction.bind(null, id, "open")} size="md">
              Re-open
            </ActionButton>
          )
        }
      />
      <Card>
        <CardBody>
          <MessageThread messages={thread} viewer="admin" names={{ company: row.company.name, candidate: row.candidate.fullName }} />
        </CardBody>
      </Card>
    </div>
  );
}
