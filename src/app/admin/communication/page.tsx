import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, companies, conversations, mailRelayLog, messages, users } from "@/db/schema";
import { moderateMessageAction } from "@/actions/admin";
import { ActionButton } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, Td, Th } from "@/components/ui";
import { LEAK_REASON_LABELS, type LeakReason } from "@/lib/contact-guard";
import { formatDateTime, timeAgo } from "@/lib/format";
import { adminCounts } from "@/server/admin-queries";

export const metadata: Metadata = { title: "Communication" };

export default async function AdminCommunicationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "moderation" } = await searchParams;
  const counts = await adminCounts();
  return (
    <div className="space-y-4">
      <PageHeader title="Communication" description="Email routing, communication logs, abuse detection and message moderation." />
      <Tabs
        items={[
          { href: "/admin/communication", label: "Moderation queue", active: tab === "moderation", count: counts.flagged },
          { href: "/admin/communication?tab=conversations", label: "Conversations", active: tab === "conversations" },
          { href: "/admin/communication?tab=relay", label: "Email relay log", active: tab === "relay" },
        ]}
      />
      {tab === "relay" ? <RelayLog /> : tab === "conversations" ? <Conversations /> : <Moderation />}
    </div>
  );
}

async function Moderation() {
  const rows = await db
    .select({ message: messages, sender: users, conversation: conversations })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(users, eq(users.id, messages.senderUserId))
    .where(eq(messages.flagged, true))
    .orderBy(desc(messages.createdAt));
  if (!rows.length) return <EmptyState title="No flagged messages" description="Messages that try to share phone numbers, personal emails or messaging-app handles appear here." />;
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Sender</Th>
            <Th>Original message</Th>
            <Th>Detected</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ message: m, sender, conversation }) => (
            <tr key={m.id}>
              <Td>
                <p className="font-medium">{sender?.name ?? "—"}</p>
                <p className="text-xs text-ink-3">{m.senderRole} · {sender?.violationCount ?? 0} total flags</p>
                <p className="font-mono text-xs text-ink-3">{m.fromAddress}</p>
              </Td>
              <Td className="max-w-md">
                <p className="text-ink">{m.originalBody ?? m.body}</p>
                <p className="mt-1 text-xs text-ink-2">Delivered as: {m.body}</p>
                <Link href={`/admin/communication/${conversation.id}`} className="text-xs text-accent hover:underline">Open conversation</Link>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {m.flagReasons.map((r) => (
                    <Badge key={r} tone="warn">{LEAK_REASON_LABELS[r as LeakReason] ?? r}</Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-3">{timeAgo(m.createdAt)}</p>
              </Td>
              <Td>
                <Badge tone={m.moderationStatus === "pending_review" ? "warn" : "neutral"}>{m.moderationStatus.replace("_", " ")}</Badge>
                {conversation.status !== "open" ? <Badge tone="bad" className="ml-1">Conversation {conversation.status}</Badge> : null}
              </Td>
              <Td className="min-w-40">
                {m.moderationStatus === "pending_review" ? (
                  <div className="flex flex-col items-start gap-1">
                    <ActionButton action={moderateMessageAction.bind(null, m.id, "dismiss")}>Dismiss</ActionButton>
                    <ActionButton action={moderateMessageAction.bind(null, m.id, "block")} variant="ghost" confirm="Block this conversation?">Block conversation</ActionButton>
                    <ActionButton action={moderateMessageAction.bind(null, m.id, "suspend")} variant="danger" confirm="Suspend the sender's account?">Suspend sender</ActionButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

async function Conversations() {
  const rows = await db
    .select({
      conversation: conversations,
      company: companies.name,
      candidate: candidates.fullName,
      count: sql<number>`(select count(*) from messages m where m.conversation_id = ${sql.raw('"conversations"."id"')})`,
      flagged: sql<number>`(select count(*) from messages m where m.conversation_id = ${sql.raw('"conversations"."id"')} and m.flagged = 1)`,
    })
    .from(conversations)
    .innerJoin(companies, eq(companies.id, conversations.companyId))
    .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
    .orderBy(desc(conversations.lastMessageAt));
  if (!rows.length) return <EmptyState title="No conversations" />;
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Company ↔ Candidate</Th>
            <Th>Subject</Th>
            <Th>Messages</Th>
            <Th>Last activity</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ conversation: c, company, candidate, count, flagged }) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/admin/communication/${c.id}`} className="font-medium hover:text-accent">
                  {company} ↔ {candidate}
                </Link>
              </Td>
              <Td>{c.subject}</Td>
              <Td>
                {Number(count)} {Number(flagged) ? <Badge tone="warn">{flagged} flagged</Badge> : null}
              </Td>
              <Td>{timeAgo(c.lastMessageAt ?? c.createdAt)}</Td>
              <Td><Badge tone={c.status === "open" ? "good" : "bad"}>{c.status}</Badge></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

async function RelayLog() {
  const rows = await db.select().from(mailRelayLog).orderBy(desc(mailRelayLog.createdAt)).limit(200);
  if (!rows.length) return <EmptyState title="No relay activity yet" />;
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Direction</Th>
            <Th>From → To (masked)</Th>
            <Th>Delivered to</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{formatDateTime(r.createdAt)}</Td>
              <Td className="capitalize">{r.direction}</Td>
              <Td className="font-mono text-xs">
                {r.maskedFrom} → {r.maskedTo}
                {r.subject ? <p className="font-sans text-ink-3">{r.subject}</p> : null}
              </Td>
              <Td className="text-xs">{r.realRecipient ?? "—"}</Td>
              <Td>
                <Badge tone={r.status === "delivered" ? "good" : r.status === "logged" ? "info" : "bad"}>{r.status}</Badge>
                {r.error ? <p className="text-xs text-red-700 dark:text-red-300">{r.error}</p> : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
