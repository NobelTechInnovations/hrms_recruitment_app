"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

export function NavLink({ href, icon, children, exact = false, count, variant = "side" }: { href: string; icon?: ReactNode; children: ReactNode; exact?: boolean; count?: number; variant?: "side" | "top" }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  if (variant === "top") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm", active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-subtle")}
      >
        {children}
        {count ? <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white dark:text-black">{count}</span> : null}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-subtle hover:text-ink",
      )}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {count ? <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white dark:text-black">{count}</span> : null}
    </Link>
  );
}
