import type { Metadata } from "next";
import { createJobAction } from "@/actions/company";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui";
import { requireCompany } from "@/server/auth";
import { jobDefaults } from "../job-defaults";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const { company } = await requireCompany("jobs.manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Post a job" back={{ href: "/company/jobs", label: "Jobs" }} />
      {company.verificationStatus !== "verified" ? <Alert tone="warn" title="Your company isn't verified yet">Published jobs will be reviewed by our moderation team before they go live.</Alert> : null}
      <Card>
        <CardBody>
          <JobForm action={createJobAction} d={jobDefaults(null, company.industry)} isNew />
        </CardBody>
      </Card>
    </div>
  );
}
