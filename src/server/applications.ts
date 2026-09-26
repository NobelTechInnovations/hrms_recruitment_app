// Applications & the hiring pipeline (README §7, §10).

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, candidates, companies, jobs, recommendations, resumes, type Application } from "@/db/schema";
import { matchCandidateToJob } from "@/lib/matching";
import { canTransition, stageLabel, stageMessage, type Actor } from "@/lib/pipeline";
import { educationsByCandidate, toMatchCandidate } from "./queries";
import { notify, notifyCompany } from "./notify";
import { onStageChanged, type StageExtras } from "./placements";
import { UserError } from "@/lib/errors";

export class PipelineError extends UserError {}

export async function applyToJob(input: {
  candidateId: string;
  jobId: string;
  resumeId?: string | null;
  uploadedResumeDocId?: string | null;
  coverNote?: string | null;
  source?: Application["source"];
}): Promise<Application> {
  const [row] = await db.select({ job: jobs, company: companies }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(eq(jobs.id, input.jobId)).limit(1);
  if (!row || row.job.status !== "active") throw new PipelineError("This job is no longer accepting applications.");
  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, input.candidateId)).limit(1);
  if (!candidate) throw new PipelineError("Candidate profile not found.");

  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.jobId, input.jobId), eq(applications.candidateId, input.candidateId)))
    .limit(1);
  if (existing) throw new PipelineError("You have already applied to this job.");

  let resumeId = input.resumeId ?? null;
  if (resumeId) {
    const [r] = await db.select({ id: resumes.id }).from(resumes).where(and(eq(resumes.id, resumeId), eq(resumes.candidateId, candidate.id))).limit(1);
    if (!r) resumeId = null;
  } else if (!input.uploadedResumeDocId) {
    const [def] = await db.select({ id: resumes.id }).from(resumes).where(and(eq(resumes.candidateId, candidate.id), eq(resumes.isDefault, true))).limit(1);
    resumeId = def?.id ?? null;
  }

  const eds = (await educationsByCandidate([candidate.id])).get(candidate.id) ?? [];
  const match = matchCandidateToJob(toMatchCandidate(candidate, eds), row.job);

  const [app] = await db
    .insert(applications)
    .values({
      jobId: row.job.id,
      candidateId: candidate.id,
      companyId: row.job.companyId,
      resumeId,
      uploadedResumeDocId: input.uploadedResumeDocId ?? null,
      coverNote: input.coverNote ?? null,
      source: input.source ?? "direct",
      matchScore: match.score,
    })
    .returning();
  await db.insert(applicationEvents).values({ applicationId: app!.id, fromStage: null, toStage: "applied", actorUserId: candidate.userId, note: null });
  await db
    .update(recommendations)
    .set({ status: "applied", respondedAt: new Date() })
    .where(and(eq(recommendations.candidateId, candidate.id), eq(recommendations.jobId, row.job.id)));

  await notifyCompany(row.job.companyId, {
    type: "new_application",
    title: `New application: ${row.job.title}`,
    body: `${candidate.fullName} applied (${match.score}% match${match.eligible ? "" : ", does not meet all mandatory requirements"}).`,
    link: `/company/applications/${app!.id}`,
  });
  return app!;
}

export async function changeStage(input: {
  applicationId: string;
  to: string;
  actor: Actor;
  actorUserId: string;
  companyId?: string; // required when actor is company — scopes the update
  candidateId?: string; // required when actor is candidate
  note?: string | null;
  rejectionReason?: string | null;
  extras?: StageExtras;
}): Promise<Application> {
  const [app] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
  if (!app) throw new PipelineError("Application not found.");
  if (input.actor === "company" && app.companyId !== input.companyId) throw new PipelineError("Application not found.");
  if (input.actor === "candidate" && app.candidateId !== input.candidateId) throw new PipelineError("Application not found.");

  const check = canTransition(app.stage, input.to, input.actor);
  if (!check.ok) throw new PipelineError(check.reason);
  if (input.to === "offer" && !input.extras?.offeredCtc) throw new PipelineError("Enter the offered CTC to record an offer.");

  const now = new Date();
  const [updated] = await db
    .update(applications)
    .set({
      stage: input.to as Application["stage"],
      updatedAt: now,
      rejectionReason: input.to === "rejected" ? (input.rejectionReason ?? null) : app.rejectionReason,
      firstResponseAt: app.firstResponseAt ?? (input.actor === "company" ? now : null),
    })
    .where(eq(applications.id, app.id))
    .returning();
  await db.insert(applicationEvents).values({ applicationId: app.id, fromStage: app.stage, toStage: input.to, actorUserId: input.actorUserId, note: input.note ?? null });
  await onStageChanged(updated!, input.to, input.extras ?? {}, now);

  const [ctx] = await db
    .select({ jobTitle: jobs.title, companyName: companies.name, candidateUserId: candidates.userId, candidateName: candidates.fullName })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(eq(applications.id, app.id))
    .limit(1);
  if (ctx) {
    if (input.actor === "company") {
      const msg = stageMessage(input.to, ctx.jobTitle, ctx.companyName);
      await notify(ctx.candidateUserId, { type: "application_stage", title: msg.title, body: msg.body, link: `/candidate/applications/${app.id}` });
    } else {
      await notifyCompany(app.companyId, {
        type: "application_withdrawn",
        title: `${ctx.candidateName} ${stageLabel(input.to).toLowerCase()} their application`,
        body: ctx.jobTitle,
        link: `/company/applications/${app.id}`,
      });
    }
  }
  return updated!;
}
