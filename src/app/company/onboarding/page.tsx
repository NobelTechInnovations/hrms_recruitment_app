import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/shell";
import { Card } from "@/components/ui";
import { getMembershipForUser, requireUser } from "@/server/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your company" };

export default async function CompanyOnboardingPage() {
  const user = await requireUser();
  if (user.role !== "company") redirect("/");
  if (await getMembershipForUser(user.id)) redirect("/company");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <form action={logoutAction}>
          <button className="text-sm text-ink-2 hover:text-ink">Sign out</button>
        </form>
      </div>
      <h1 className="text-2xl font-semibold text-ink">Set up your company</h1>
      <p className="mt-1 text-sm text-ink-2">
        Your profile shows as <strong>UNVERIFIED COMPANY</strong> until our team verifies your registration, GST, PAN and billing details. You can prepare jobs meanwhile.
      </p>
      <Card className="mt-6 p-6">
        <OnboardingForm defaultEmail={user.email} />
      </Card>
    </div>
  );
}
