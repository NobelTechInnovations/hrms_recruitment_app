import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getCurrentUser, homePathFor } from "@/server/auth";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const { role } = await searchParams;
  const initialRole = role === "company" ? "company" : "candidate";
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-2">Free for job seekers. Companies pay only when they hire.</p>
      <Card className="mt-6 p-6">
        <RegisterForm initialRole={initialRole} />
      </Card>
    </div>
  );
}
