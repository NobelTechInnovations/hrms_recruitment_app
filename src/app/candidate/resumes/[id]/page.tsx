import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import { companies, jobs, resumes } from "@/db/schema";
import { updateResumeAction } from "@/actions/candidate";
import { ResumePreview } from "@/components/resume-preview";
import { ButtonLink, Card, CardBody, CardHeader, Meter, PageHeader } from "@/components/ui";
import { resumeInsights } from "@/lib/resume-insights";
import { requireCandidate } from "@/server/auth";
import { loadCandidateBundle } from "@/server/queries";
import { buildResumeData } from "@/server/resume-data";
import { ResumeEditor } from "./editor";

export const metadata: Metadata = { title: "Edit resume" };

export default async function ResumeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { candidate } = await requireCandidate();
  const [resume] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.candidateId, candidate.id)))
    .limit(1);
  if (!resume) notFound();
  const b = (await loadCandidateBundle(candidate.id))!;
  const activeJobs = await db.select({ id: jobs.id, title: jobs.title, company: companies.name, requiredSkills: jobs.requiredSkills, preferredSkills: jobs.preferredSkills }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId)).where(eq(jobs.status, "active")).orderBy(desc(jobs.publishedAt));
  const targetJob = activeJobs.find((j) => j.id === resume.targetJobId) ?? null;
  const data = buildResumeData(resume, b);
  const insights = resumeInsights(
    {
      headline: data.headline,
      summary: data.summary,
      skills: data.skills,
      sections: resume.sections,
      experiences: b.experiences,
      educationCount: b.educations.length,
      certificationCount: b.certifications.length,
      projectCount: b.projects.length,
      languages: data.languages,
      experienceYears: candidate.experienceYears,
    },
    targetJob,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title={resume.title}
        back={{ href: "/candidate/resumes", label: "All resumes" }}
        actions={
          <ButtonLink href={`/api/resumes/${resume.id}/pdf`} prefetch={false}>
            <Download className="h-4 w-4" aria-hidden /> Download PDF
          </ButtonLink>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[26rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Edit" />
            <CardBody>
              <ResumeEditor
                action={updateResumeAction.bind(null, resume.id)}
                jobOptions={activeJobs.map((j) => ({ value: j.id, label: `${j.title} — ${j.company}` }))}
                d={{
                  title: resume.title,
                  template: resume.template,
                  targetRole: resume.targetRole ?? "",
                  headline: resume.headline ?? "",
                  summary: resume.summary ?? "",
                  skills: resume.skills.join(", "),
                  sections: resume.sections,
                  targetJobId: resume.targetJobId ?? "",
                }}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Completeness" />
            <CardBody className="space-y-3">
              <Meter value={insights.completeness} label="Resume completeness" />
              {insights.suggestions.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {insights.suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">Looks great — nothing to add.</p>
              )}
              <p className="text-xs text-ink-3">
                Missing experience or education? <Link href="/candidate/profile" className="text-accent hover:underline">Update your profile</Link>.
              </p>
            </CardBody>
          </Card>
        </div>
        <div className="overflow-x-auto rounded-xl bg-subtle p-4 sm:p-6">
          <ResumePreview data={data} />
        </div>
      </div>
    </div>
  );
}
