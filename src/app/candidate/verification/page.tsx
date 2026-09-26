import type { Metadata } from "next";
import { FileText, Trash2 } from "lucide-react";
import { deleteDocumentAction, uploadDocumentAction } from "@/actions/candidate";
import { CandidateVerificationBadges } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Alert, Badge, Card, CardBody, CardHeader, Checklist, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { CANDIDATE_DOC_TYPES, DOC_TYPE_VERIFIES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { requireCandidate } from "@/server/auth";
import { loadCandidateBundle, scoreFor } from "@/server/queries";
import { UploadDocumentForm } from "./upload-form";

export const metadata: Metadata = { title: "Verification" };

const STATUS_TONE = { pending: "warn", approved: "good", rejected: "bad" } as const;

export default async function VerificationPage() {
  const { candidate } = await requireCandidate();
  const b = (await loadCandidateBundle(candidate.id))!;
  const score = scoreFor(b);
  const docs = b.documents.filter((d) => d.docType !== "resume");
  return (
    <div className="space-y-6">
      <PageHeader title="Verification" description="Upload documents to earn verification badges. Verified candidates rank higher in company searches." />
      <Alert tone="info" title="Your documents stay private">
        Documents are visible only to authorised platform verification staff. Companies see the badge (e.g. “Experience Verified ✓”), never the document — unless you explicitly allow sharing specific document types in Privacy &amp; consent.
      </Alert>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader title="Upload a document" />
          <CardBody>
            <UploadDocumentForm action={uploadDocumentAction} options={CANDIDATE_DOC_TYPES.filter((d) => d.value !== "resume")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your badges" />
          <CardBody className="space-y-3">
            <Checklist items={score.verification} />
            <CandidateVerificationBadges candidate={candidate} />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Submitted documents" />
        {docs.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Verifies</Th>
                <Th>Uploaded</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <a href={`/api/files/${d.id}`} target="_blank" className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent">
                      <FileText className="h-4 w-4 text-ink-3" aria-hidden />
                      {labelOf(CANDIDATE_DOC_TYPES, d.docType)}
                    </a>
                    <p className="text-xs text-ink-3">{d.fileName}</p>
                  </Td>
                  <Td className="capitalize">{DOC_TYPE_VERIFIES[d.docType] ?? "Supporting"}</Td>
                  <Td>{formatDate(d.createdAt)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[d.status]}>{d.status === "pending" ? "Under review" : d.status === "approved" ? "Verified ✓" : "Rejected"}</Badge>
                    {d.reviewNote ? <p className="mt-1 text-xs text-ink-2">{d.reviewNote}</p> : null}
                  </Td>
                  <Td className="text-right">
                    {d.status !== "approved" ? (
                      <ActionButton action={deleteDocumentAction.bind(null, d.id)} variant="ghost" confirm="Delete this document?">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Delete</span>
                      </ActionButton>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <EmptyState title="No documents yet" description="Start with an identity proof — it unlocks the Identity Verified badge." />
          </CardBody>
        )}
      </Card>
    </div>
  );
}
