import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companyInvites } from "@/db/schema";
import { changeMemberRoleAction, removeMemberAction, revokeInviteAction } from "@/actions/company";
import { ActionButton } from "@/components/forms";
import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { COMPANY_ROLES, labelOf, type CompanyRole } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { appUrl } from "@/server/notify";
import { requireCompany } from "@/server/auth";
import { companyMembersList } from "@/server/company-queries";
import { InviteMemberForm, RoleSelect } from "./team-forms";

export const metadata: Metadata = { title: "Recruiter workspace" };

export default async function TeamPage() {
  const { user, company } = await requireCompany("team.manage");
  const [members, invites] = await Promise.all([
    companyMembersList(company.id),
    db.select().from(companyInvites).where(and(eq(companyInvites.companyId, company.id), eq(companyInvites.status, "pending"))).orderBy(desc(companyInvites.createdAt)),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Recruiter workspace" description={`Invite HR and hiring colleagues to ${company.name} with role-based permissions.`} />
      <Card>
        <CardHeader title="Invite a colleague" />
        <CardBody>
          <InviteMemberForm />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Team" description={`${members.length} ${members.length === 1 ? "member" : "members"}`} />
        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {members.map(({ member, user: u }) => (
              <tr key={member.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} size={30} />
                    <div>
                      <p className="font-medium">{u.name} {u.id === user.id ? <span className="text-ink-3">(you)</span> : null}</p>
                      <p className="text-xs text-ink-3">{u.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>{u.id === user.id ? <Badge tone="accent">{labelOf(COMPANY_ROLES, member.role)}</Badge> : <RoleSelect action={changeMemberRoleAction.bind(null, member.id)} role={member.role} />}</Td>
                <Td>{formatDate(member.createdAt)}</Td>
                <Td className="text-right">
                  {u.id !== user.id ? (
                    <ActionButton action={removeMemberAction.bind(null, member.id)} variant="ghost" confirm={`Remove ${u.name} from the workspace?`}>
                      Remove
                    </ActionButton>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {invites.length ? (
        <Card>
          <CardHeader title="Pending invitations" />
          <CardBody>
            <ul className="divide-y divide-line text-sm">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium text-ink">{inv.email}</span> <span className="text-ink-2">· {labelOf(COMPANY_ROLES, inv.role)} · invited {formatDate(inv.createdAt)}</span>
                    <span className="block break-all font-mono text-xs text-ink-3">{appUrl(`/invite/${inv.token}`)}</span>
                  </span>
                  <ActionButton action={revokeInviteAction.bind(null, inv.id)} variant="ghost">
                    Revoke
                  </ActionButton>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Role permissions" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(ROLE_DESCRIPTIONS) as CompanyRole[]).map((r) => (
              <div key={r}>
                <dt className="font-medium text-ink">{labelOf(COMPANY_ROLES, r)}</dt>
                <dd className="text-sm text-ink-2">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
