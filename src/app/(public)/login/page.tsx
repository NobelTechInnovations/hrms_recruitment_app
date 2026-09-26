import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getCurrentUser, homePathFor } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const DEMO = [
  ["Admin", "admin@panel.com"],
  ["Company (verified)", "hr@xyzsoft.com"],
  ["Company recruiter", "recruiter@xyzsoft.com"],
  ["Company (pending)", "hr@brightretail.in"],
  ["Candidate", "asha@example.com"],
  ["Candidate (Find Jobs For Me)", "vikram@example.com"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const { next } = await searchParams;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-ink-2">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
        <Card className="mt-6 p-6">
          <LoginForm next={next} />
        </Card>
      </div>
      {process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS ? (
        <Card className="self-start p-6">
          <p className="text-sm font-medium text-ink">Demo accounts</p>
          <p className="mt-1 text-sm text-ink-2">
            Seeded by <code className="rounded bg-subtle px-1">npm run db:seed</code>. Password for all: <code className="rounded bg-subtle px-1">Password@123</code>
          </p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {DEMO.map(([role, email]) => (
              <li key={email} className="flex items-center justify-between gap-3 py-2">
                <span className="text-ink-2">{role}</span>
                <code className="text-ink">{email}</code>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
