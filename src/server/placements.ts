// Placement lifecycle & the 60-day deferred fee (README §11).

import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, companies, invoices, jobs, placements, type Application, type Placement } from "@/db/schema";
import { evaluateDeparture, milestoneDate, placementFee } from "@/lib/billing";
import { formatDate, formatINR, formatLpa } from "@/lib/format";
import { getPlan } from "@/lib/plans";
import { createInvoice } from "./invoices";
import { notifyAdmins, notifyCompany } from "./notify";
import { UserError } from "@/lib/errors";

export type StageExtras = { offeredCtc?: number | null; expectedJoiningDate?: Date | null; joiningDate?: Date | null };

export async function onStageChanged(app: Application, to: string, extras: StageExtras, now = new Date()): Promise<void> {
  const [existing] = await db.select().from(placements).where(eq(placements.applicationId, app.id)).limit(1);

  if (to === "selected" && !existing) {
    const [company] = await db.select().from(companies).where(eq(companies.id, app.companyId)).limit(1);
    const plan = getPlan(company?.planCode);
    await db.insert(placements).values({
      applicationId: app.id,
      companyId: app.companyId,
      candidateId: app.candidateId,
      jobId: app.jobId,
      planCode: plan.code,
      selectedAt: now,
      guaranteeDays: plan.guaranteeDays,
      replacementDays: plan.replacementDays,
    });
    return;
  }
  if (!existing) return;

  if (to === "offer") {
    await db
      .update(placements)
      .set({ offeredCtc: extras.offeredCtc ?? existing.offeredCtc, expectedJoiningDate: extras.expectedJoiningDate ?? existing.expectedJoiningDate, updatedAt: now })
      .where(eq(placements.id, existing.id));
  } else if (to === "joined") {
    const joiningDate = extras.joiningDate ?? now;
    await db
      .update(placements)
      .set({
        joiningDate,
        milestoneDate: milestoneDate(joiningDate, existing.guaranteeDays),
        status: "in_guarantee",
        offeredCtc: extras.offeredCtc ?? existing.offeredCtc,
        updatedAt: now,
      })
      .where(eq(placements.id, existing.id));
    await closeJobIfFilled(app.jobId, now);
  } else if ((to === "rejected" || to === "withdrawn") && existing.status === "pending_joining") {
    await db.update(placements).set({ status: "cancelled", updatedAt: now }).where(eq(placements.id, existing.id));
  }
}

async function closeJobIfFilled(jobId: string, now: Date) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job || job.status !== "active") return;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.jobId, jobId), eq(applications.stage, "joined")));
  if (Number(row?.n ?? 0) >= job.vacancies) {
    await db.update(jobs).set({ status: "closed", closedAt: now, updatedAt: now }).where(eq(jobs.id, jobId));
  }
}

async function placementContext(p: Placement) {
  const [row] = await db
    .select({ candidateName: candidates.fullName, jobTitle: jobs.title })
    .from(candidates)
    .innerJoin(jobs, eq(jobs.id, p.jobId))
    .where(eq(candidates.id, p.candidateId))
    .limit(1);
  return row ?? { candidateName: "Candidate", jobTitle: "Role" };
}

/** Generate fees for placements whose guarantee period has ended. */
export async function processMilestones(now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(placements)
    .where(and(eq(placements.status, "in_guarantee"), lte(placements.milestoneDate, now)));
  for (const p of due) {
    const plan = getPlan(p.planCode);
    const fee = placementFee(plan, p.offeredCtc);
    const ctx = await placementContext(p);
    if (fee > 0) {
      const invoice = await createInvoice({
        companyId: p.companyId,
        kind: "placement_fee",
        placementId: p.id,
        amount: fee,
        description: `Placement fee — ${ctx.candidateName}, ${ctx.jobTitle} (${plan.placementFeePercent}% of ${formatLpa(p.offeredCtc)}; joined ${formatDate(p.joiningDate)})`,
        now,
      });
      await db.update(placements).set({ status: "fee_due", feeAmount: fee, invoiceId: invoice.id, updatedAt: now }).where(eq(placements.id, p.id));
    } else {
      await db.update(placements).set({ status: "completed", feeAmount: 0, updatedAt: now }).where(eq(placements.id, p.id));
    }
    await notifyCompany(
      p.companyId,
      {
        type: "placement_milestone",
        title: `${ctx.candidateName} completed ${p.guaranteeDays} days`,
        body: fee > 0 ? `The ${p.guaranteeDays}-day milestone was reached; a placement fee of ${formatINR(fee)} (+GST) has been invoiced.` : `The ${p.guaranteeDays}-day milestone was reached. No placement fee applies on your plan.`,
        link: "/company/billing",
      },
      "billing.manage",
    );
  }
  return due.length;
}

/** Record that a placed candidate did not join or left the company. */
export async function recordDeparture(placementId: string, companyId: string, leftAt: Date, reason: string | null) {
  const [p] = await db
    .select()
    .from(placements)
    .where(and(eq(placements.id, placementId), eq(placements.companyId, companyId)))
    .limit(1);
  if (!p) throw new UserError("Placement not found");
  const now = new Date();

  if (p.status === "pending_joining" || !p.joiningDate) {
    await db.update(placements).set({ status: "cancelled", leftAt, leftReason: reason, updatedAt: now }).where(eq(placements.id, p.id));
    return { outcome: "cancelled" as const, explanation: "The candidate did not join — the placement was cancelled and no fee applies." };
  }
  if (p.leftAt) throw new UserError("A departure has already been recorded for this placement.");

  const result = evaluateDeparture({ joiningDate: p.joiningDate, guaranteeDays: p.guaranteeDays, replacementDays: p.replacementDays }, leftAt);
  const replacementStatus = result.outcome !== "no_action" && p.replacementDays > 0 ? "eligible" : "none";
  await db
    .update(placements)
    .set({
      leftAt,
      leftReason: reason,
      replacementStatus,
      status: result.outcome === "fee_waived" ? "fee_waived" : p.status,
      updatedAt: now,
    })
    .where(eq(placements.id, p.id));
  if (result.outcome === "fee_waived" && p.invoiceId) {
    await db.update(invoices).set({ status: "void" }).where(and(eq(invoices.id, p.invoiceId), sql`${invoices.status} in ('issued','overdue')`));
  }
  return { outcome: result.outcome, explanation: result.explanation };
}

export async function requestReplacement(placementId: string, companyId: string) {
  const [p] = await db
    .update(placements)
    .set({ replacementStatus: "requested", updatedAt: new Date() })
    .where(and(eq(placements.id, placementId), eq(placements.companyId, companyId), eq(placements.replacementStatus, "eligible")))
    .returning();
  if (!p) throw new UserError("This placement is not eligible for a replacement.");
  const ctx = await placementContext(p);
  await notifyAdmins({ type: "replacement_request", title: "Replacement requested", body: `${ctx.jobTitle}: replacement requested after ${ctx.candidateName} left.`, link: "/admin/finance" });
  return p;
}

export async function resolveReplacement(placementId: string, resolution: "fulfilled" | "refunded") {
  const [p] = await db.update(placements).set({ replacementStatus: resolution, updatedAt: new Date() }).where(eq(placements.id, placementId)).returning();
  if (p && resolution === "refunded" && p.invoiceId) {
    await db.update(invoices).set({ status: "refunded" }).where(eq(invoices.id, p.invoiceId));
  }
  if (p) {
    await notifyCompany(p.companyId, { type: "replacement", title: resolution === "fulfilled" ? "Replacement arranged" : "Placement fee refunded", link: "/company/billing" }, "billing.manage");
  }
  return p;
}
