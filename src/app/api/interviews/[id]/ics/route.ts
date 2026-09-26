import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, candidates, companies, interviews, jobs } from "@/db/schema";
import { buildIcs } from "@/lib/ics";
import { getCurrentUser, getMembershipForUser } from "@/server/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [row] = await db
    .select({ interview: interviews, app: applications, job: jobs, company: companies, candidate: candidates })
    .from(interviews)
    .innerJoin(applications, eq(applications.id, interviews.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(eq(interviews.id, id))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  const membership = user.role === "company" ? await getMembershipForUser(user.id) : null;
  const allowed = user.role === "admin" || row.candidate.userId === user.id || membership?.company.id === row.company.id;
  if (!allowed) return new Response("Not found", { status: 404 });

  const { interview, job, company, candidate } = row;
  const ics = buildIcs({
    uid: `${interview.id}@hrms-talent`,
    title: `${interview.title}: ${job.title} — ${company.name}`,
    description: [`Candidate: ${candidate.fullName}`, interview.meetingUrl ? `Join: ${interview.meetingUrl}` : null, `Messages: ${company.maskedEmail}`].filter(Boolean).join("\n"),
    start: interview.scheduledAt,
    durationMinutes: interview.durationMinutes,
    location: interview.meetingUrl ?? interview.location,
    url: interview.meetingUrl,
    sequence: interview.rescheduleCount,
    cancelled: interview.status === "cancelled",
  });
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="interview-${interview.id.slice(0, 8)}.ics"` },
  });
}
