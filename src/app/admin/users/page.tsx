import type { Metadata } from "next";
import Link from "next/link";
import { setUserStatusAction } from "@/actions/admin";
import { ActionButton } from "@/components/forms";
import { Badge, Card, Input, PageHeader, Table, Tabs, Td, Th } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/format";
import { requireAdmin } from "@/server/auth";
import { usersWithContext } from "@/server/admin-queries";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string }> }) {
  const admin = await requireAdmin();
  const { role, q } = await searchParams;
  let rows = await usersWithContext();
  const counts = { all: rows.length, candidate: rows.filter((r) => r.user.role === "candidate").length, company: rows.filter((r) => r.user.role === "company").length, admin: rows.filter((r) => r.user.role === "admin").length };
  if (role) rows = rows.filter((r) => r.user.role === role);
  if (q) rows = rows.filter((r) => [r.user.name, r.user.email, r.companyName].some((v) => v?.toLowerCase().includes(q.toLowerCase())));
  rows.sort((a, b) => b.user.createdAt.getTime() - a.user.createdAt.getTime());
  return (
    <div className="space-y-4">
      <PageHeader title="Users" description="Job seekers, companies & recruiters, and admins." />
      <Tabs
        items={[
          { href: "/admin/users", label: "All", active: !role, count: counts.all },
          { href: "/admin/users?role=candidate", label: "Job seekers", active: role === "candidate", count: counts.candidate },
          { href: "/admin/users?role=company", label: "Companies & recruiters", active: role === "company", count: counts.company },
          { href: "/admin/users?role=admin", label: "Admins", active: role === "admin", count: counts.admin },
        ]}
      />
      <form method="get" className="flex max-w-md gap-2">
        {role ? <input type="hidden" name="role" value={role} /> : null}
        <label htmlFor="q" className="sr-only">Search</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Search name, email or company" />
        <button className="rounded-lg border border-line-strong px-3 text-sm hover:bg-subtle">Search</button>
      </form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Organisation</Th>
              <Th>Joined</Th>
              <Th>Last login</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, companyName, candidateId }) => (
              <tr key={user.id}>
                <Td>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-ink-3">{user.email}</p>
                </Td>
                <Td className="capitalize">{user.role === "company" ? "Company" : user.role}</Td>
                <Td>{companyName ?? (candidateId ? <Link href={`/admin/verification?tab=documents&candidate=${candidateId}`} className="text-accent hover:underline">Documents</Link> : "—")}</Td>
                <Td>{formatDate(user.createdAt)}</Td>
                <Td>{user.lastLoginAt ? timeAgo(user.lastLoginAt) : "—"}</Td>
                <Td>
                  <Badge tone={user.status === "active" ? "good" : "bad"}>{user.status}</Badge>
                  {user.violationCount ? <Badge tone="warn" className="ml-1" title="Messages flagged for sharing contact details">{user.violationCount} flags</Badge> : null}
                </Td>
                <Td className="text-right">
                  {user.id !== admin.id ? (
                    user.status === "active" ? (
                      <ActionButton action={setUserStatusAction.bind(null, user.id, "suspended")} variant="danger" confirm={`Suspend ${user.name}? They will be signed out immediately.`}>
                        Suspend
                      </ActionButton>
                    ) : (
                      <ActionButton action={setUserStatusAction.bind(null, user.id, "active")}>Re-activate</ActionButton>
                    )
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
