import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { FileText, Trash2 } from "lucide-react";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { deleteCompanyDocumentAction, submitVerificationAction, uploadCompanyDocumentAction } from "@/actions/company";
import { CompanyVerificationBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Alert, Badge, Card, CardBody, CardHeader, Checklist, PageHeader } from "@/components/ui";
import { companyVerificationChecklist, isReadyForVerification } from "@/lib/company-verification";
import { COMPANY_DOC_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { requireCompany } from "@/server/auth";
import { UploadDocumentForm } from "@/app/candidate/verification/upload-form";
import { CompanyProfileForm } from "./company-form";

export const metadata: Metadata = { title: "Company & verification" };

export default async function CompanyProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { company } = await requireCompany("company.edit");
  const { welcome } = await searchParams;
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.ownerType, "company"), eq(documents.ownerId, company.id)));
  const checks = companyVerificationChecklist(company, docs);
  const ready = isReadyForVerification(checks);
  const s = (v: string | null | undefined) => v ?? "";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Company & verification"
        description={<span className="flex flex-wrap items-center gap-2">Status: <CompanyVerificationBadge status={company.verificationStatus} size="lg" /> <Link href={`/companies/${company.id}`} className="text-accent hover:underline">View public trust profile</Link></span>}
      />
      {welcome ? <Alert tone="good" title="Workspace created">Fill in your company details and upload registration documents, then submit for verification.</Alert> : null}
      {company.verificationStatus === "rejected" ? <Alert tone="bad" title="Verification not approved">{company.verificationNote ?? "Please review your details and resubmit."}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardBody>
            <CompanyProfileForm
              d={{
                name: company.name,
                legalName: s(company.legalName),
                registrationNumber: s(company.registrationNumber),
                gstNumber: s(company.gstNumber),
                pan: s(company.pan),
                addressLine: s(company.addressLine),
                city: s(company.city),
                state: s(company.state),
                pincode: s(company.pincode),
                website: s(company.website),
                businessEmail: company.businessEmail,
                contactName: s(company.contactName),
                contactDesignation: s(company.contactDesignation),
                contactPhone: s(company.contactPhone),
                contactEmail: s(company.contactEmail),
                industry: s(company.industry),
                size: s(company.size),
                hiringRequirements: s(company.hiringRequirements),
                description: s(company.description),
                billingName: s(company.billingName),
                billingAddress: s(company.billingAddress),
                billingEmail: s(company.billingEmail),
                billingGstNumber: s(company.billingGstNumber),
                gstApplicable: company.gstApplicable,
              }}
            />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Verification checklist" />
            <CardBody className="space-y-4">
              <Checklist items={checks} />
              {company.verificationStatus === "verified" ? (
                <p className="text-sm text-green-700 dark:text-green-400">Verified on {formatDate(company.verifiedAt)}.</p>
              ) : company.verificationStatus === "pending" ? (
                <p className="text-sm text-ink-2">Submitted {formatDate(company.verificationSubmittedAt)} — under review.</p>
              ) : (
                <ActionButton action={submitVerificationAction} variant={ready ? "primary" : "secondary"} size="md">
                  Submit for verification
                </ActionButton>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Compliance documents" />
            <CardBody className="space-y-4">
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-2 text-sm">
                    <a href={`/api/files/${d.id}`} target="_blank" className="inline-flex items-start gap-1.5 text-ink hover:text-accent">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                      {labelOf(COMPANY_DOC_TYPES, d.docType)}
                    </a>
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge tone={d.status === "approved" ? "good" : d.status === "rejected" ? "bad" : "warn"}>{d.status === "pending" ? "In review" : d.status}</Badge>
                      {d.status !== "approved" ? (
                        <ActionButton action={deleteCompanyDocumentAction.bind(null, d.id)} variant="ghost" confirm="Delete this document?">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">Delete</span>
                        </ActionButton>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <UploadDocumentForm action={uploadCompanyDocumentAction} options={COMPANY_DOC_TYPES} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
