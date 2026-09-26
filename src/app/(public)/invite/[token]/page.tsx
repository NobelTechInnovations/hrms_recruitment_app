import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyInvites } from "@/db/schema";
import { acceptInviteAsCurrentUser } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Card } from "@/components/ui";
import { COMPANY_ROLES, labelOf } from "@/lib/constants";
import { getCurrentUser } from "@/server/auth";
import { RegisterForm } from "../../register/register-form";

export const metadata: Metadata = { title: "Join a recruiter workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ invite: companyInvites, company: companies })
    .from(companyInvites)
    .innerJoin(companies, eq(companies.id, companyInvites.companyId))
    .where(and(eq(companyInvites.token, token), eq(companyInvites.status, "pending")))
    .limit(1);
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">Join a recruiter workspace</h1>
      {!row ? (
        <div className="mt-6">
          <Alert tone="bad" title="This invitation is invalid or has already been used." />
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">
            {row.company.name} invited <strong>{row.invite.email}</strong> as {labelOf(COMPANY_ROLES, row.invite.role)}.
          </p>
          <Card className="mt-6 p-6">
            {user ? (
              <ActionForm action={acceptInviteAsCurrentUser}>
                <input type="hidden" name="token" value={token} />
                <p className="mb-4 text-sm text-ink-2">Signed in as {user.email}.</p>
                <SubmitButton className="w-full">Accept invitation</SubmitButton>
              </ActionForm>
            ) : (
              <RegisterForm initialRole="company" invite={{ token, email: row.invite.email, companyName: row.company.name }} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
