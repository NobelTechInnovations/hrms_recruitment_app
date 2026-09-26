import { redirect } from "next/navigation";
import { adminNav, candidateNav, companyNav } from "@/components/navs";
import { AppShell } from "@/components/shell";
import { getMembershipForUser, requireUser } from "@/server/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  let nav;
  if (user.role === "admin") nav = adminNav();
  else if (user.role === "candidate") nav = candidateNav();
  else {
    const membership = await getMembershipForUser(user.id);
    if (!membership) redirect("/company/onboarding");
    nav = companyNav(membership.member.role);
  }
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
