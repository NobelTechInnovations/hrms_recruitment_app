import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { markAllReadAction } from "@/actions/account";
import { ActionButton } from "@/components/forms";
import { ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unread} unread`}
        actions={
          <>
            <ButtonLink href="/settings" variant="ghost" size="sm">
              Channels
            </ButtonLink>
            {unread ? <ActionButton action={markAllReadAction}>Mark all as read</ActionButton> : null}
          </>
        }
      />
      {rows.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className={cx("px-5 py-4", !n.readAt && "bg-accent-soft/40")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cx("text-sm text-ink", !n.readAt && "font-semibold")}>
                      {!n.readAt ? <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" /> : null}
                      {n.link ? (
                        <Link href={n.link} className="hover:text-accent">
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                      {!n.readAt ? <span className="sr-only"> (unread)</span> : null}
                    </p>
                    {n.body ? <p className="mt-0.5 text-sm text-ink-2">{n.body}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="You're all caught up" />
      )}
    </div>
  );
}
