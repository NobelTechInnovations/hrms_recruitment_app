import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationDeliveries, notifications, users } from "@/db/schema";
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notification log" };

export default async function AdminNotificationsPage() {
  const rows = await db
    .select({ delivery: notificationDeliveries, notification: notifications, user: users })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .innerJoin(users, eq(users.id, notificationDeliveries.userId))
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(200);
  return (
    <div className="space-y-4">
      <PageHeader title="Notification log" description="Email, SMS and WhatsApp deliveries. Without provider credentials, messages are logged here instead of sent." />
      <Card>
        <CardBody className="text-sm text-ink-2">
          Configure <code>SMTP_URL</code> for email and <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_SMS_FROM</code>, <code>TWILIO_WHATSAPP_FROM</code> for SMS/WhatsApp.
        </CardBody>
      </Card>
      {rows.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Recipient</Th>
                <Th>Channel</Th>
                <Th>Notification</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ delivery: d, notification: n, user }) => (
                <tr key={d.id}>
                  <Td>{formatDateTime(d.createdAt)}</Td>
                  <Td>
                    {user.name}
                    <p className="text-xs text-ink-3">{d.destination ?? "—"}</p>
                  </Td>
                  <Td className="capitalize">{d.channel}</Td>
                  <Td className="max-w-sm">
                    {n.title}
                    {n.body ? <p className="text-xs text-ink-3">{n.body}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={d.status === "sent" ? "good" : d.status === "logged" ? "info" : d.status === "skipped" ? "neutral" : "bad"}>{d.status}</Badge>
                    <p className="text-xs text-ink-3">{d.provider}{d.error ? ` · ${d.error}` : ""}</p>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="No deliveries yet" />
      )}
    </div>
  );
}
