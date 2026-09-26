import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { companies, documents } from "@/db/schema";
import { featureCompanyAction, reviewCompanyAction, reviewDocumentAction } from "@/actions/admin";
import { CompanyVerificationBadge } from "@/components/badges";
import { DecisionForms } from "@/components/decision";
import { ActionButton } from "@/components/forms";
import { Alert, Badge, Card, CardBody, CardHeader, Checklist, DescriptionList, PageHeader } from "@/components/ui";
import { companyVerificationChecklist } from "@/lib/company-verification";
import { COMPANY_DOC_TYPES, COMPANY_SIZES, INDUSTRIES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getPlan } from "@/lib/plans";
import { companyTrustStats, formatResponseTime } from "@/server/queries";

export const metadata: Metadata = { title: "Company verification" };

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!c) notFound();
  const docs = await db.select().from(documents).where(and(eq(documents.ownerType, "company"), eq(documents.ownerId, c.id)));
  const checks = companyVerificationChecklist(c, docs);
  const trust = await companyTrustStats(c.id);
  return (
    <div className="space-y-6">
      <PageHeader title={c.name} back={{ href: "/admin/verification", label: "Verification" }} description={<span className="flex items-center gap-2"><CompanyVerificationBadge status={c.verificationStatus} size="lg" /> Submitted {formatDate(c.verificationSubmittedAt)}</span>} />
      {c.verificationNote ? <Alert tone="info" title="Last review note">{c.verificationNote}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Registration & compliance" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Legal name", value: c.legalName ?? "—" },
                  { label: "Registration no.", value: c.registrationNumber ?? "—" },
                  { label: "PAN", value: c.pan ?? "—" },
                  { label: "GST", value: c.gstApplicable ? (c.gstNumber ?? "Missing") : "Not applicable" },
                  { label: "Address", value: [c.addressLine, c.city, c.state, c.pincode].filter(Boolean).join(", ") || "—" },
                  { label: "Website", value: c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{c.website}</a> : "—" },
                  { label: "Business email", value: c.businessEmail },
                  { label: "Relay address", value: <span className="font-mono">{c.maskedEmail}</span> },
                  { label: "Contact person", value: [c.contactName, c.contactDesignation, c.contactPhone, c.contactEmail].filter(Boolean).join(" · ") || "—" },
                  { label: "Industry / size", value: `${labelOf(INDUSTRIES, c.industry)} · ${labelOf(COMPANY_SIZES, c.size)}` },
                  { label: "Billing", value: [c.billingName, c.billingEmail, c.billingAddress].filter(Boolean).join(" · ") || "—" },
                  { label: "Plan", value: getPlan(c.planCode).name },
                ]}
              />
              {c.hiringRequirements ? <p className="mt-4 text-sm text-ink-2"><span className="font-medium text-ink">Hiring requirements:</span> {c.hiringRequirements}</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Documents" />
            <CardBody>
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <a href={`/api/files/${d.id}`} target="_blank" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
                      <FileText className="h-4 w-4" aria-hidden />
                      {labelOf(COMPANY_DOC_TYPES, d.docType)}
                    </a>
                    {d.status === "pending" ? (
                      <DecisionForms approve={reviewDocumentAction.bind(null, d.id, "approved")} reject={reviewDocumentAction.bind(null, d.id, "rejected")} />
                    ) : (
                      <Badge tone={d.status === "approved" ? "good" : "bad"}>{d.status}</Badge>
                    )}
                  </li>
                ))}
                {!docs.length ? <li className="py-3 text-sm text-ink-2">No documents uploaded.</li> : null}
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Decision" />
            <CardBody className="space-y-4">
              <Checklist items={checks} />
              {c.verificationStatus !== "verified" ? (
                <DecisionForms approve={reviewCompanyAction.bind(null, c.id, "verified")} reject={reviewCompanyAction.bind(null, c.id, "rejected")} approveLabel="Mark as VERIFIED" notePlaceholder="e.g. GST certificate doesn't match the registered name" />
              ) : (
                <DecisionForms reject={reviewCompanyAction.bind(null, c.id, "rejected")} rejectLabel="Revoke verification" />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Trust profile" />
            <CardBody className="space-y-3 text-sm">
              <DescriptionList
                columns={2}
                items={[
                  { label: "Jobs posted", value: trust.jobsPosted },
                  { label: "Hires", value: trust.successfulHires },
                  { label: "Applications", value: trust.applicationsReceived },
                  { label: "Avg. response", value: formatResponseTime(trust.avgResponseHours) },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <ActionButton action={featureCompanyAction.bind(null, c.id, 30)}>Feature for 30 days</ActionButton>
                {c.featuredUntil && c.featuredUntil > new Date() ? <ActionButton action={featureCompanyAction.bind(null, c.id, 0)} variant="ghost">Remove featured</ActionButton> : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
