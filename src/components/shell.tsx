import Link from "next/link";
import type { ReactNode } from "react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Bell, LogOut, Settings } from "lucide-react";
import { db } from "@/db";
import { notifications, type User } from "@/db/schema";
import { logoutAction } from "@/actions/auth";
import { NavLink } from "./nav-link";
import { Avatar } from "./ui";

export type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean; count?: number };

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold text-ink ${className}`}>
      <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white dark:text-black">
        H
      </span>
      <span>
        HRMS <span className="font-normal text-ink-2">Talent</span>
      </span>
    </Link>
  );
}

export async function AppShell({ user, nav, context, children }: { user: User; nav: NavItem[]; context?: ReactNode; children: ReactNode }) {
  const unread = await unreadCount(user.id);
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-4">
          <Logo />
        </div>
        {context ? <div className="mx-3 mb-2 rounded-lg bg-subtle px-3 py-2 text-xs text-ink-2">{context}</div> : null}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} exact={item.exact} count={item.count}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-3 py-3">
          <div className="flex items-center gap-2.5 px-2">
            <Avatar name={user.name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-3">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Logo className="lg:hidden" />
            <div className="flex-1" />
            <Link href="/notifications" className="relative rounded-lg p-2 text-ink-2 hover:bg-subtle hover:text-ink" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="h-5 w-5" />
              {unread ? <span className="absolute right-1 top-1 min-w-4 rounded-full bg-critical px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread > 99 ? "99+" : unread}</span> : null}
            </Link>
            <Link href="/settings" className="rounded-lg p-2 text-ink-2 hover:bg-subtle hover:text-ink" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} exact={item.exact} count={item.count} variant="top">
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
