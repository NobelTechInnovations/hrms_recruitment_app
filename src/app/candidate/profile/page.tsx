import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { deleteProfileItemAction } from "@/actions/candidate";
import { ActionButton } from "@/components/forms";
import { Alert, Avatar, Card, CardBody, CardHeader, Meter } from "@/components/ui";
import { EDUCATION_LEVELS, labelOf } from "@/lib/constants";
import { requireCandidate } from "@/server/auth";
import { loadCandidateBundle, scoreFor } from "@/server/queries";
import { CertificationForm, EducationForm, ExperienceForm, PhotoForm, ProfileForm, ProjectForm, type ProfileDefaults } from "./forms";

export const metadata: Metadata = { title: "Profile" };

const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));

function monthLabel(ym: string | null) {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, candidate } = await requireCandidate();
  const { welcome } = await searchParams;
  const b = (await loadCandidateBundle(candidate.id))!;
  const score = scoreFor(b);
  const d: ProfileDefaults = {
    fullName: candidate.fullName,
    headline: s(candidate.headline),
    summary: s(candidate.summary),
    dateOfBirth: s(candidate.dateOfBirth),
    gender: s(candidate.gender),
    phone: s(user.phone),
    currentLocation: s(candidate.currentLocation),
    preferredLocations: candidate.preferredLocations.join(", "),
    industry: s(candidate.industry),
    currentCompany: s(candidate.currentCompany),
    currentDesignation: s(candidate.currentDesignation),
    experienceYears: s(candidate.experienceYears),
    currentCtc: s(candidate.currentCtc),
    expectedCtc: s(candidate.expectedCtc),
    noticePeriodDays: s(candidate.noticePeriodDays),
    availability: candidate.availability,
    workModePreference: candidate.workModePreference,
    skills: candidate.skills.join(", "),
    languages: candidate.languages.join(", "),
    linkedinUrl: s(candidate.linkedinUrl),
    portfolioUrl: s(candidate.portfolioUrl),
    otherProfileUrl: s(candidate.otherProfileUrl),
  };
  const del = (kind: "education" | "experience" | "certification" | "project", id: string) => (
    <ActionButton action={deleteProfileItemAction.bind(null, kind, id)} variant="ghost" confirm="Remove this entry?">
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Remove</span>
    </ActionButton>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={candidate.fullName} src={candidate.photoKey ? `/api/photos/${candidate.id}` : null} size={56} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Your profile</h1>
            <p className="text-sm text-ink-2">Companies see a protected relay address ({candidate.maskedEmail}) instead of your email.</p>
          </div>
        </div>
        <div className="w-full max-w-xs">
          <Meter value={score.completion} label="Profile completion" />
        </div>
      </div>
      {welcome ? (
        <Alert tone="good" title="Welcome! Let's build your profile.">
          A complete, verified profile gets matched to more jobs. Start with the basics below, then upload verification documents and take the Level 1 assessment.
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <div className="mb-6">
            <PhotoForm />
          </div>
          <ProfileForm d={d} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Work experience" description="Most recent first." />
        <CardBody className="space-y-5">
          {b.experiences.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="font-medium text-ink">
                  {e.title} · {e.company}
                </p>
                <p className="text-sm text-ink-2">
                  {monthLabel(e.startDate)} – {e.isCurrent ? "Present" : monthLabel(e.endDate)}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                {e.description ? <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{e.description}</p> : null}
              </div>
              {del("experience", e.id)}
            </div>
          ))}
          <ExperienceForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Education" />
        <CardBody className="space-y-5">
          {b.educations.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="font-medium text-ink">{e.degree}</p>
                <p className="text-sm text-ink-2">
                  {e.institution} · {labelOf(EDUCATION_LEVELS, e.level)}
                  {e.endYear ? ` · ${e.startYear ? `${e.startYear}–` : ""}${e.endYear}` : ""}
                  {e.grade ? ` · ${e.grade}` : ""}
                </p>
              </div>
              {del("education", e.id)}
            </div>
          ))}
          <EducationForm />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Certifications" />
          <CardBody className="space-y-4">
            {b.certifications.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <p className="text-sm text-ink">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-ink-2">{[c.issuer, c.year].filter(Boolean).length ? ` · ${[c.issuer, c.year].filter(Boolean).join(" · ")}` : ""}</span>
                </p>
                {del("certification", c.id)}
              </div>
            ))}
            <CertificationForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Projects & portfolio" />
          <CardBody className="space-y-4">
            {b.projects.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div className="text-sm">
                  <p className="font-medium text-ink">{p.name}</p>
                  {p.description ? <p className="text-ink-2">{p.description}</p> : null}
                </div>
                {del("project", p.id)}
              </div>
            ))}
            <ProjectForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
