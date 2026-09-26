import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { updateJobAction } from "@/actions/company";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { requireCompany } from "@/server/auth";
import { jobDefaults } from "../../job-defaults";
import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await requireCompany("jobs.manage");
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.companyId, company.id))).limit(1);
  if (!job) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit: ${job.title}`} back={{ href: `/company/jobs/${job.id}`, label: "Back to job" }} />
      <Card>
        <CardBody>
          <JobForm action={updateJobAction.bind(null, job.id)} d={jobDefaults(job)} isNew={false} />
        </CardBody>
      </Card>
    </div>
  );
}
