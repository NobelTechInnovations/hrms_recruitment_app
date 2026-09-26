import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobs } from "@/db/schema";
import { CompanyVerificationBadge } from "@/components/badges";
import { JobCard } from "@/components/job-card";
import { Card, CardBody, CardHeader, DescriptionList, EmptyState, StatTile } from "@/components/ui";
import { COMPANY_SIZES, INDUSTRIES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { companyTrustStats, formatResponseTime } from "@/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [c] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, (await params).id)).limit(1);
  return { title: c ? c.name : "Company" };
}

export default async function CompanyTrustPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();
  const [trust, openJobs] = await Promise.all([
    companyTrustStats(company.id),
    db.select().from(jobs).where(and(eq(jobs.companyId, company.id), eq(jobs.status, "active"))).orderBy(desc(jobs.publishedAt)),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{company.name}</h1>
        <CompanyVerificationBadge status={company.verificationStatus} size="lg" />
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {labelOf(INDUSTRIES, company.industry)} · {labelOf(COMPANY_SIZES, company.size)} · {company.city ?? "India"}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Jobs posted" value={trust.jobsPosted} />
        <StatTile label="Open positions" value={trust.activeJobs} />
        <StatTile label="Successful hires" value={trust.successfulHires} hint="Candidates who joined via the platform" />
        <StatTile label="Average response time" value={formatResponseTime(trust.avgResponseHours)} hint="From application to first action" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Open jobs</h2>
          {openJobs.length ? (
            <div className="space-y-3">
              {openJobs.map((j) => (
                <JobCard key={j.id} job={j} company={company} />
              ))}
            </div>
          ) : (
            <EmptyState title="No open jobs right now" />
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="Trust profile" description="Verifiable facts only — no anonymous ratings." />
          <CardBody className="space-y-4 text-sm">
            {company.description ? <p className="text-ink-2">{company.description}</p> : null}
            <DescriptionList
              columns={1}
              items={[
                { label: "Verification", value: company.verificationStatus === "verified" ? `Verified on ${formatDate(company.verifiedAt)}` : "Not yet verified" },
                { label: "Website", value: company.website ? <a className="text-accent hover:underline" href={company.website} rel="noopener noreferrer nofollow" target="_blank">{company.website.replace(/^https?:\/\//, "")}</a> : "—" },
                { label: "Hiring on the platform since", value: formatDate(trust.memberSince) },
                { label: "Applications received", value: trust.applicationsReceived },
              ]}
            />
            <p className="text-xs text-ink-3">Contact the company by applying to a job — all communication is routed through the platform to protect both sides.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
