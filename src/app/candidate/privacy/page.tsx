import type { Metadata } from "next";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { CANDIDATE_DOC_TYPES } from "@/lib/constants";
import { requireCandidate } from "@/server/auth";
import { PrivacyForm } from "./privacy-form";

export const metadata: Metadata = { title: "Privacy & consent" };

export default async function PrivacyPage() {
  const { candidate } = await requireCandidate();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Privacy & consent" description="You control who sees your profile, who can contact you and which documents can be shared." />
      <Card>
        <CardBody>
          <PrivacyForm
            d={{
              profileVisibility: candidate.profileVisibility,
              appearInSearch: candidate.appearInSearch,
              allowRecruiterContact: candidate.allowRecruiterContact,
              allowRecommendations: candidate.allowRecommendations,
              shareableDocTypes: candidate.shareableDocTypes,
            }}
            docTypes={CANDIDATE_DOC_TYPES}
          />
        </CardBody>
      </Card>
    </div>
  );
}
