import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, gt, and } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, companies, findJobsRequests, interviews, jobs, placements, recommendations } from "@/db/schema";
import { MatchScore, PlacementStatusBadge, StageBadge } from "@/components/badges";
import { BarList, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Tabs, Td, Th } from "@/components/ui";
import { formatDate, formatDateTime, formatLpa, timeAgo } from "@/lib/format";
import { ALL_STAGES } from "@/lib/constants";
import { daysFromNow } from "@/lib/time";


export const metadata: Metadata = { title: "Recruitment" };

export default async function AdminRecruitmentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "desk" } = await searchParams;
  return (
    <div className="space-y-4">
      <PageHeader title="Recruitment" description="Applications, interviews, placements, hiring pipeline and the Find Jobs For Me desk." />
      <Tabs
        items={[
          { href: "/admin/recruitment", label: "Find Jobs For Me desk", active: tab === "desk" },
          { href: "/admin/recruitment?tab=applications", label: "Applications", active: tab === "applications" },
          { href: "/admin/recruitment?tab=interviews", label: "Interviews", active: tab === "interviews" },
          { href: "/admin/recruitment?tab=placements", label: "Placements", active: tab === "placements" },
        ]}
      />
      {tab === "applications" ? <Applications /> : tab === "interviews" ? <Interviews /> : tab === "placements" ? <Placements /> : <Desk />}
    </div>
  );
}

async function Desk() {
  const rows = await db.select({ req: findJobsRequests, candidate: candidates }).from(findJobsRequests).innerJoin(candidates, eq(candidates.id, findJobsRequests.candidateId)).orderBy(desc(findJobsRequests.updatedAt));
  const recs = await db.select({ candidateId: recommendations.candidateId, status: recommendations.status }).from(recommendations);
  return rows.length ? (
    <Card>
      <CardHeader title="Active requests" description="Match → Recommend → Apply/Seek consent → Schedule interview" />
      <Table>
        <thead>
          <tr>
            <Th>Candidate</Th>
            <Th>Wants</Th>
            <Th>Mode</Th>
            <Th>Recommendations</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ req, candidate }) => {
            const mine = recs.filter((r) => r.candidateId === candidate.id);
            return (
              <tr key={req.id}>
                <Td>
                  <p className="font-medium">{candidate.fullName}</p>
                  <p className="text-xs text-ink-3">{candidate.headline}</p>
                </Td>
                <Td>
                  {req.desiredRole}
                  <p className="text-xs text-ink-3">
                    {req.preferredLocations.join(", ") || "Any location"} · {formatLpa(req.expectedCtc)} · joins in {req.joiningAvailabilityDays ?? "?"} days
                  </p>
                  {req.notes ? <p className="text-xs italic text-ink-2">“{req.notes}”</p> : null}
                </Td>
                <Td>{req.applyMode === "auto_apply" ? "Auto-apply" : "Ask first"}</Td>
                <Td>
                  {mine.length} sent · {mine.filter((r) => r.status === "pending").length} awaiting · {mine.filter((r) => r.status === "applied").length} applied
                  <p className="text-xs text-ink-3">Last matched {req.lastMatchedAt ? timeAgo(req.lastMatchedAt) : "never"}</p>
                </Td>
                <Td>{req.status}</Td>
                <Td className="text-right">
                  <Link href={`/admin/recruitment/find-jobs/${candidate.id}`} className="text-sm font-medium text-accent hover:underline">
                    Find matches
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  ) : (
    <EmptyState title="No Find Jobs For Me requests yet" />
  );
}

async function Applications() {
  const rows = await db
    .select({ app: applications, job: jobs, company: companies, candidate: candidates })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .orderBy(desc(applications.updatedAt))
    .limit(200);
  const byStage = ALL_STAGES.map((s) => ({ label: s.label, value: rows.filter((r) => r.app.stage === s.value).length })).filter((r) => r.value > 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Current stage of all applications" />
        <CardBody>
          <BarList ariaLabel="Applications by current stage" rows={byStage} />
        </CardBody>
      </Card>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Candidate</Th>
              <Th>Job</Th>
              <Th>Company</Th>
              <Th>Match</Th>
              <Th>Stage</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ app, job, company, candidate }) => (
              <tr key={app.id}>
                <Td className="font-medium">{candidate.fullName}</Td>
                <Td>{job.title}</Td>
                <Td>{company.name}</Td>
                <Td>{app.matchScore != null ? <MatchScore score={app.matchScore} /> : "—"}</Td>
                <Td><StageBadge stage={app.stage} /></Td>
                <Td>{timeAgo(app.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

async function Interviews() {
  const rows = await db
    .select({ interview: interviews, job: jobs, company: companies, candidate: candidates })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(and(eq(interviews.status, "scheduled"), gt(interviews.scheduledAt, daysFromNow(-1))))
    .orderBy(asc(interviews.scheduledAt));
  return rows.length ? (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Candidate</Th>
            <Th>Interview</Th>
            <Th>Company</Th>
            <Th>Reminder</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ interview, job, company, candidate }) => (
            <tr key={interview.id}>
              <Td>{formatDateTime(interview.scheduledAt)}</Td>
              <Td>{candidate.fullName}</Td>
              <Td>
                {interview.title}
                <p className="text-xs text-ink-3">{job.title}</p>
              </Td>
              <Td>{company.name}</Td>
              <Td>{interview.reminderSentAt ? `Sent ${timeAgo(interview.reminderSentAt)}` : "Pending"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  ) : (
    <EmptyState title="No upcoming interviews" />
  );
}

async function Placements() {
  const rows = await db
    .select({ placement: placements, job: jobs, company: companies, candidate: candidates })
    .from(placements)
    .innerJoin(jobs, eq(jobs.id, placements.jobId))
    .innerJoin(companies, eq(companies.id, placements.companyId))
    .innerJoin(candidates, eq(candidates.id, placements.candidateId))
    .orderBy(desc(placements.selectedAt));
  return rows.length ? (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Candidate</Th>
            <Th>Company / job</Th>
            <Th>Selected</Th>
            <Th>Joined</Th>
            <Th>Milestone</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ placement: p, job, company, candidate }) => (
            <tr key={p.id}>
              <Td className="font-medium">{candidate.fullName}</Td>
              <Td>
                {company.name}
                <p className="text-xs text-ink-3">{job.title} · {formatLpa(p.offeredCtc)}</p>
              </Td>
              <Td>{formatDate(p.selectedAt)}</Td>
              <Td>{formatDate(p.joiningDate)}</Td>
              <Td>{formatDate(p.milestoneDate)}</Td>
              <Td><PlacementStatusBadge status={p.status} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  ) : (
    <EmptyState title="No placements yet" />
  );
}
