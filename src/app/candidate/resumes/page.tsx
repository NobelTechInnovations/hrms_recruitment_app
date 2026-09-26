import type { Metadata } from "next";
import Link from "next/link";
import { Copy, Download, FileText, Star, Trash2 } from "lucide-react";
import { deleteDocumentAction, deleteResumeAction, duplicateResumeAction, setDefaultResumeAction, uploadDocumentAction } from "@/actions/candidate";
import { ActionButton } from "@/components/forms";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/format";
import { requireCandidate } from "@/server/auth";
import { loadCandidateBundle } from "@/server/queries";
import { UploadDocumentForm } from "../verification/upload-form";
import { NewResumeForm } from "./new-resume-form";

export const metadata: Metadata = { title: "Resume builder" };

export default async function ResumesPage() {
  const { candidate } = await requireCandidate();
  const b = (await loadCandidateBundle(candidate.id))!;
  const uploaded = b.documents.filter((d) => d.docType === "resume");
  return (
    <div className="space-y-6">
      <PageHeader title="Resume builder" description="Keep different versions — IT, Management, Sales — and pick the right one when you apply." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {b.resumes.length ? (
            b.resumes.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-8 w-8 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0">
                    <Link href={`/candidate/resumes/${r.id}`} className="font-medium text-ink hover:text-accent">
                      {r.title}
                    </Link>
                    <p className="text-xs text-ink-3">
                      <span className="capitalize">{r.template}</span> template · updated {timeAgo(r.updatedAt)}
                      {r.targetRole ? ` · for ${r.targetRole}` : ""}
                    </p>
                  </div>
                  {r.isDefault ? <Badge tone="accent">Default</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <ButtonLink href={`/candidate/resumes/${r.id}`} size="sm" variant="secondary">
                    Edit
                  </ButtonLink>
                  <ButtonLink href={`/api/resumes/${r.id}/pdf`} size="sm" variant="ghost" prefetch={false}>
                    <Download className="h-3.5 w-3.5" aria-hidden /> PDF
                  </ButtonLink>
                  {!r.isDefault ? (
                    <ActionButton action={setDefaultResumeAction.bind(null, r.id)} variant="ghost">
                      <Star className="h-3.5 w-3.5" aria-hidden /> Make default
                    </ActionButton>
                  ) : null}
                  <ActionButton action={duplicateResumeAction.bind(null, r.id)} variant="ghost">
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Duplicate</span>
                  </ActionButton>
                  <ActionButton action={deleteResumeAction.bind(null, r.id)} variant="ghost" confirm={`Delete “${r.title}”?`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Delete</span>
                  </ActionButton>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="No resumes yet" description="Create your first resume — it's built from your profile, so it only takes a minute." />
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Create a resume" />
            <CardBody>
              <NewResumeForm defaultHeadline={candidate.headline ?? ""} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Uploaded resume files" description="Already have a resume? Upload it and choose it when applying." />
            <CardBody className="space-y-3">
              {uploaded.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <a href={`/api/files/${d.id}`} target="_blank" className="truncate text-ink hover:text-accent">
                    {d.fileName}
                  </a>
                  <span className="flex items-center gap-1 text-xs text-ink-3">
                    {formatDate(d.createdAt)}
                    <ActionButton action={deleteDocumentAction.bind(null, d.id)} variant="ghost" confirm="Delete this file?">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Delete</span>
                    </ActionButton>
                  </span>
                </div>
              ))}
              <UploadDocumentForm action={uploadDocumentAction} options={[{ value: "resume", label: "Resume file" }]} defaultType="resume" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
