import { adminNav } from "@/components/navs";
import { AppShell } from "@/components/shell";
import { requireAdmin } from "@/server/auth";
import { adminCounts } from "@/server/admin-queries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const counts = await adminCounts();
  return (
    <AppShell user={user} nav={adminNav({ verification: counts.verification, jobs: counts.jobs, flagged: counts.flagged })} context={<span className="font-medium text-ink">Platform administration</span>}>
      {children}
    </AppShell>
  );
}
