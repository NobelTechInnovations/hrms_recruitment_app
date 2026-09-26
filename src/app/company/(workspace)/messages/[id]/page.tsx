import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { candidates, conversations, messages } from "@/db/schema";
import { companySendMessageAction } from "@/actions/company";
import { MessageComposer } from "@/components/message-composer";
import { MessageThread } from "@/components/message-thread";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui";
import { requireCompany } from "@/server/auth";

export const metadata: Metadata = { title: "Conversation" };

export default async function CompanyConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await requireCompany("messages.send");
  const [row] = await db
    .select({ conversation: conversations, candidate: candidates })
    .from(conversations)
    .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
    .where(and(eq(conversations.id, id), eq(conversations.companyId, company.id)))
    .limit(1);
  if (!row) notFound();
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, id), eq(messages.senderRole, "candidate"), isNull(messages.readAt)));
  const thread = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={row.candidate.fullName}
        back={{ href: "/company/messages", label: "Messages" }}
        description={
          <span>
            {row.conversation.subject} · <span className="font-mono text-xs">{row.candidate.maskedEmail}</span>
            {row.conversation.applicationId ? (
              <>
                {" · "}
                <Link href={`/company/applications/${row.conversation.applicationId}`} className="text-accent hover:underline">
                  Open application
                </Link>
              </>
            ) : null}
          </span>
        }
      />
      <Card>
        <CardBody>
          <MessageThread messages={thread} viewer="company" names={{ company: "You", candidate: row.candidate.fullName }} />
        </CardBody>
      </Card>
      {row.conversation.status === "open" ? (
        <Card>
          <CardBody>
            <MessageComposer action={companySendMessageAction.bind(null, id)} />
          </CardBody>
        </Card>
      ) : (
        <Alert tone="warn" title="This conversation was closed by platform moderation." />
      )}
    </div>
  );
}
