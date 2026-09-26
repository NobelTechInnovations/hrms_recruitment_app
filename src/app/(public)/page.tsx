import Link from "next/link";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { BadgeCheck, CalendarClock, ClipboardCheck, FileText, IndianRupee, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { db } from "@/db";
import { candidates, companies, jobs } from "@/db/schema";
import { ButtonLink, Card } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

async function stats() {
  const [[verified], [activeJobs], [qualified]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(companies).where(eq(companies.verificationStatus, "verified")),
    db.select({ n: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "active")),
    db.select({ n: sql<number>`count(*)` }).from(candidates).where(and(isNotNull(candidates.level1QualifiedAt))),
  ]);
  return { verified: Number(verified?.n ?? 0), activeJobs: Number(activeJobs?.n ?? 0), qualified: Number(qualified?.n ?? 0) };
}

const seekerSteps = ["Register", "Complete profile", "Verify identity, education & experience", "Take Level 1 assessment", "Take industry assessment", "Build resume", "Browse & apply", "Interview", "Offer & join"];
const companySteps = ["Register", "Submit company verification", "Verify billing details", "Become a Verified Company", "Post jobs", "Receive matched candidates", "Shortlist & interview", "Candidate joins", "60-day tracking, then fee"];

export default async function HomePage() {
  const s = await stats();
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified on both sides
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Hire pre-screened talent. Find verified jobs. Keep your contact details private.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Companies are verified before they hire. Candidates are verified and assessed before they apply. Every message is routed through the platform — no personal email or phone number is exposed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/jobs">Browse verified jobs</ButtonLink>
              <ButtonLink href="/register?role=company" variant="secondary">
                Hire verified candidates
              </ButtonLink>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                ["Verified companies", s.verified],
                ["Active jobs", s.activeJobs],
                ["Screened candidates", s.qualified],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-sm text-ink-2">{label}</dt>
                  <dd className="text-3xl font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Card className="self-center p-6">
            <p className="text-sm font-medium text-ink">How protected messaging works</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg bg-subtle p-3">
                <p className="text-ink-3">Company writes from</p>
                <p className="font-mono text-ink">hr_53543@panel.com</p>
              </div>
              <p className="text-center text-ink-3" aria-hidden>
                ↕ routed &amp; screened by the platform ↕
              </p>
              <div className="rounded-lg bg-subtle p-3">
                <p className="text-ink-3">Candidate replies from</p>
                <p className="font-mono text-ink">candidate_82731@panel.com</p>
              </div>
              <p className="text-ink-2">Real addresses (hr@xyz.com, your Gmail) are never shown. Attempts to share phone numbers or personal emails are removed and flagged for review.</p>
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-ink">Why this marketplace is different</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [BadgeCheck, "Verified companies", "Registration, GST, PAN and billing details are checked. Unverified companies are clearly labelled UNVERIFIED COMPANY."],
            [ClipboardCheck, "Two-level screening", "Level 1 aptitude plus a Level 2 industry assessment (IT, Finance, Sales, HR) before companies spend time interviewing."],
            [Sparkles, "Transparent matching", "Every match explains itself: skills, experience, education, location, CTC and notice period — no opaque AI score."],
            [Mail, "Privacy-protected communication", "Platform relay addresses for both sides with spam protection, audit history and moderation."],
            [CalendarClock, "Complete interview workflow", "Pipeline from Applied to Joined, scheduling, calendar invites, video links, reminders and structured feedback."],
            [IndianRupee, "Pay after 60 days", "Companies pay a placement fee only after the hire completes 60 days. Candidates never pay."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof BadgeCheck;
            return (
              <Card key={title as string} className="p-5">
                <I className="h-5 w-5 text-accent" aria-hidden />
                <h3 className="mt-3 font-semibold text-ink">{title as string}</h3>
                <p className="mt-1 text-sm text-ink-2">{body as string}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="companies" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          {[
            { title: "For job seekers", icon: Users, steps: seekerSteps, cta: { href: "/register", label: "Create your profile" } },
            { title: "For companies", icon: FileText, steps: companySteps, cta: { href: "/register?role=company", label: "Register your company" } },
          ].map((col) => (
            <div key={col.title}>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <col.icon className="h-5 w-5 text-accent" aria-hidden />
                {col.title}
              </h2>
              <ol className="mt-5 space-y-2">
                {col.steps.map((step, i) => (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">{i + 1}</span>
                    <span className="text-ink">{step}</span>
                  </li>
                ))}
              </ol>
              <ButtonLink href={col.cta.href} className="mt-6">
                {col.cta.label}
              </ButtonLink>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Simple plans for companies</h2>
            <p className="mt-1 text-ink-2">No payment from candidates — ever.</p>
          </div>
          <Link href="/pricing" className="text-sm font-medium text-accent hover:underline">
            Compare plans & services →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.code} className="p-5">
              <p className="font-semibold text-ink">{p.name}</p>
              <p className="mt-1 text-sm text-ink-2">{p.tagline}</p>
              <p className="mt-4 text-2xl font-semibold text-ink">
                {p.monthlyPrice ? `${formatINR(p.monthlyPrice)}/mo` : "₹0/mo"}
              </p>
              <p className="text-sm text-ink-2">{p.placementFeePercent ? `+ ${p.placementFeePercent}% of CTC after ${p.guaranteeDays} days` : "No placement fees"}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
