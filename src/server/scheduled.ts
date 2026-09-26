// Daily/hourly background jobs. Trigger via `npm run jobs`, the admin panel,
// or a cron hitting POST /api/cron with the CRON_SECRET bearer token.

import { and, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, assessmentAttempts, candidates, companies, interviews, jobs } from "@/db/schema";
import { subscriptionCharge, subscriptionPeriodEnd } from "@/lib/billing";
import { formatWhen } from "@/lib/format";
import { getPlan } from "@/lib/plans";
import { applyToJob } from "./applications";
import { expireStaleAttempts } from "./assessments";
import { createInvoice, markOverdueInvoices } from "./invoices";
import { runFindJobsForMe } from "./matching-service";
import { notify } from "./notify";
import { processMilestones } from "./placements";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export async function sendInterviewReminders(now = new Date()): Promise<number> {
  const upcoming = await db
    .select({ interview: interviews, candidateUserId: candidates.userId, jobTitle: jobs.title, companyName: companies.name })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .where(and(eq(interviews.status, "scheduled"), isNull(interviews.reminderSentAt), gt(interviews.scheduledAt, now), lte(interviews.scheduledAt, new Date(now.getTime() + DAY))));
  for (const row of upcoming) {
    const when = formatWhen(row.interview.scheduledAt, now);
    const payload = {
      type: "interview_reminder",
      title: `Reminder: interview ${when}`,
      body: `${row.interview.title} for ${row.jobTitle} at ${row.companyName}${row.interview.meetingUrl ? ` — join: ${row.interview.meetingUrl}` : ""}.`,
    };
    await notify(row.candidateUserId, { ...payload, link: `/candidate/interviews` });
    if (row.interview.interviewerUserId) await notify(row.interview.interviewerUserId, { ...payload, link: `/company/interviews` });
    await db.update(interviews).set({ reminderSentAt: now }).where(eq(interviews.id, row.interview.id));
  }
  return upcoming.length;
}

export async function renewSubscriptions(now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(companies)
    .where(and(isNotNull(companies.subscriptionRenewsAt), lte(companies.subscriptionRenewsAt, now)));
  let count = 0;
  for (const c of due) {
    const plan = getPlan(c.planCode);
    if (plan.monthlyPrice <= 0) {
      await db.update(companies).set({ subscriptionRenewsAt: null }).where(eq(companies.id, c.id));
      continue;
    }
    const start = c.subscriptionRenewsAt!;
    const end = subscriptionPeriodEnd(start, c.billingCycle);
    await createInvoice({
      companyId: c.id,
      kind: "subscription",
      amount: subscriptionCharge(plan, c.billingCycle),
      description: `${plan.name} plan — ${c.billingCycle} subscription`,
      periodStart: start,
      periodEnd: end,
      now,
    });
    await db.update(companies).set({ subscriptionRenewsAt: end }).where(eq(companies.id, c.id));
    count++;
  }
  return count;
}

/** Nudge Level-1 qualified candidates who haven't attempted Level 2 after 3 days. */
export async function remindLevel2(now = new Date()): Promise<number> {
  const rows = await db
    .select({ candidate: candidates })
    .from(candidates)
    .where(
      and(
        isNotNull(candidates.level1QualifiedAt),
        isNull(candidates.level2QualifiedAt),
        lte(candidates.level1QualifiedAt, new Date(now.getTime() - 3 * DAY)),
        gt(candidates.level1QualifiedAt, new Date(now.getTime() - 4 * DAY)),
      ),
    );
  let count = 0;
  for (const { candidate } of rows) {
    const [attempt] = await db
      .select({ n: sql<number>`count(*)` })
      .from(assessmentAttempts)
      .where(eq(assessmentAttempts.candidateId, candidate.id));
    if (Number(attempt?.n ?? 0) > 1) continue;
    await notify(candidate.userId, { type: "assessment", title: "Please complete your Level 2 assessment.", body: "Industry-qualified candidates get noticed first by verified employers.", link: "/candidate/assessments" });
    count++;
  }
  return count;
}

export async function runScheduledJobs(now = new Date()) {
  const expiredAttempts = await expireStaleAttempts(now);
  const reminders = await sendInterviewReminders(now);
  const milestones = await processMilestones(now);
  const overdue = await markOverdueInvoices(now);
  const renewals = await renewSubscriptions(now);
  const level2Reminders = await remindLevel2(now);
  const findJobs = await runFindJobsForMe(now, (candidateId, jobId) => applyToJob({ candidateId, jobId, source: "find_jobs_for_me" }).catch(() => null));
  return { expiredAttempts, reminders, milestones, overdue, renewals, level2Reminders, ...findJobs, ranAt: now.toISOString() };
}
