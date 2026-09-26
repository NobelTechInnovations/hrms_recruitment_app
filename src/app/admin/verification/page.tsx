import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { candidates, companies, documents } from "@/db/schema";
import { reviewDocumentAction } from "@/actions/admin";
import { CandidateVerificationBadges, CompanyVerificationBadge } from "@/components/badges";
import { DecisionForms } from "@/components/decision";
import { Badge, Card, EmptyState, PageHeader, Table, Tabs, Td, Th } from "@/components/ui";
import { CANDIDATE_DOC_TYPES, DOC_TYPE_VERIFIES, labelOf } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import { companyVerificationChecklist } from "@/lib/company-verification";
import { adminCounts } from "@/server/admin-queries";

export const metadata: Metadata = { title: "Verification" };

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; candidate?: string }> }) {
  const { tab = "companies", status, candidate } = await searchParams;
  const counts = await adminCounts();
  return (
    <div className="space-y-4">
      <PageHeader title="Verification" description="Company, candidate, document and employment verification. Documents are visible only to authorised platform staff." />
      <Tabs
        items={[
          { href: "/admin/verification", label: "Companies", active: tab === "companies", count: counts.pendingCompanies },
          { href: "/admin/verification?tab=documents", label: "Candidate documents", active: tab === "documents", count: counts.pendingDocs },
        ]}
      />
      {tab === "documents" ? <DocumentsQueue status={status ?? "pending"} candidateId={candidate} /> : <CompaniesQueue />}
    </div>
  );
}

async function CompaniesQueue() {
  const rows = await db.select().from(companies).orderBy(desc(companies.verificationSubmittedAt));
  const docs = await db.select({ ownerId: documents.ownerId, docType: documents.docType, status: documents.status }).from(documents).where(eq(documents.ownerType, "company"));
  const order = { pending: 0, rejected: 1, unverified: 2, verified: 3 } as const;
  rows.sort((a, b) => order[a.verificationStatus] - order[b.verificationStatus]);
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Company</Th>
            <Th>Status</Th>
            <Th>Checklist</Th>
            <Th>Submitted</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const checks = companyVerificationChecklist(c, docs.filter((d) => d.ownerId === c.id));
            return (
              <tr key={c.id}>
                <Td>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-ink-3">
                    {c.city ?? "—"} · {c.businessEmail}
                  </p>
                </Td>
                <Td>
                  <CompanyVerificationBadge status={c.verificationStatus} />
                  {c.verificationStatus === "pending" ? <Badge tone="warn" className="ml-1">Needs review</Badge> : null}
                </Td>
                <Td>
                  {checks.filter((x) => x.done).length}/{checks.length} complete
                </Td>
                <Td>{c.verificationSubmittedAt ? timeAgo(c.verificationSubmittedAt) : "—"}</Td>
                <Td className="text-right">
                  <Link href={`/admin/verification/companies/${c.id}`} className="text-sm font-medium text-accent hover:underline">
                    Review
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

async function DocumentsQueue({ status, candidateId }: { status: string; candidateId?: string }) {
  const conds = [eq(documents.ownerType, "candidate")];
  if (status !== "all") conds.push(eq(documents.status, status as "pending" | "approved" | "rejected"));
  if (candidateId) conds.push(eq(documents.ownerId, candidateId));
  const rows = await db
    .select({ doc: documents, candidate: candidates })
    .from(documents)
    .innerJoin(candidates, eq(candidates.id, documents.ownerId))
    .where(and(...conds))
    .orderBy(desc(documents.createdAt));
  const filtered = rows.filter((r) => r.doc.docType !== "resume");
  return (
    <>
      <div className="flex gap-2 text-sm">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <Link key={s} href={`/admin/verification?tab=documents&status=${s}${candidateId ? `&candidate=${candidateId}` : ""}`} className={s === status ? "rounded-md bg-accent-soft px-2 py-1 font-medium capitalize text-accent-ink" : "rounded-md px-2 py-1 capitalize text-ink-2 hover:bg-subtle"}>
            {s}
          </Link>
        ))}
      </div>
      {filtered.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Document</Th>
                <Th>Verifies</Th>
                <Th>Uploaded</Th>
                <Th>Decision</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ doc, candidate }) => (
                <tr key={doc.id}>
                  <Td>
                    <p className="font-medium">{candidate.fullName}</p>
                    <div className="mt-1">
                      <CandidateVerificationBadges candidate={candidate} compact />
                    </div>
                  </Td>
                  <Td>
                    <a href={`/api/files/${doc.id}`} target="_blank" className="inline-flex items-center gap-1.5 text-accent hover:underline">
                      <FileText className="h-4 w-4" aria-hidden /> {labelOf(CANDIDATE_DOC_TYPES, doc.docType)}
                    </a>
                    <p className="text-xs text-ink-3">{doc.fileName}</p>
                  </Td>
                  <Td className="capitalize">{DOC_TYPE_VERIFIES[doc.docType] ?? "Supporting"}</Td>
                  <Td>{formatDate(doc.createdAt)}</Td>
                  <Td>
                    {doc.status === "pending" ? (
                      <DecisionForms approve={reviewDocumentAction.bind(null, doc.id, "approved")} reject={reviewDocumentAction.bind(null, doc.id, "rejected")} notePlaceholder="e.g. Image is blurred; name doesn't match profile" />
                    ) : (
                      <div>
                        <Badge tone={doc.status === "approved" ? "good" : "bad"}>{doc.status}</Badge>
                        {doc.reviewNote ? <p className="mt-1 text-xs text-ink-2">{doc.reviewNote}</p> : null}
                        {doc.status === "approved" ? (
                          <div className="mt-2">
                            <DecisionForms reject={reviewDocumentAction.bind(null, doc.id, "rejected")} rejectLabel="Revoke" />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="Nothing in this queue" />
      )}
    </>
  );
}
