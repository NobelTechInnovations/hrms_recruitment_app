import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { CompanyVerificationBadge } from "@/components/badges";
import { companyNav } from "@/components/navs";
import { AppShell } from "@/components/shell";
import { COMPANY_ROLES, labelOf } from "@/lib/constants";
import { requireCompany } from "@/server/auth";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { user, member, company } = await requireCompany();
  const [unread] = await db
    .select({ n: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(conversations.companyId, company.id), eq(messages.senderRole, "candidate"), isNull(messages.readAt)));
  return (
    <AppShell
      user={user}
      nav={companyNav(member.role, { messages: Number(unread?.n ?? 0) })}
      context={
        <div className="space-y-1">
          <p className="truncate font-medium text-ink">{company.name}</p>
          <CompanyVerificationBadge status={company.verificationStatus} />
          <p>
            {labelOf(COMPANY_ROLES, member.role)} · <span className="font-mono">{company.maskedEmail}</span>
          </p>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
