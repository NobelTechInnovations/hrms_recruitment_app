// What a company must provide before it can be reviewed (README §1).

import type { Company, DocumentRow } from "@/db/schema";

export type VerificationCheck = { label: string; done: boolean };

export function companyVerificationChecklist(c: Company, docs: Pick<DocumentRow, "docType" | "status">[]): VerificationCheck[] {
  const hasDoc = (type: string) => docs.some((d) => d.docType === type && d.status !== "rejected");
  const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;
  const checks: VerificationCheck[] = [
    { label: "Company / organization name", done: filled(c.name) },
    { label: "Registration number (CIN / LLPIN / Udyam)", done: filled(c.registrationNumber) },
    { label: "PAN / business identification", done: filled(c.pan) },
    { label: "Company address", done: filled(c.addressLine) && filled(c.city) && filled(c.pincode) },
    { label: "Official website", done: filled(c.website) },
    { label: "Business email", done: filled(c.businessEmail) },
    { label: "Contact person details", done: filled(c.contactName) && filled(c.contactPhone) },
    { label: "Industry and company size", done: filled(c.industry) && filled(c.size) },
    { label: "Hiring requirements", done: filled(c.hiringRequirements) },
    { label: "Billing details", done: filled(c.billingName) && filled(c.billingAddress) && filled(c.billingEmail) },
    { label: "Certificate of incorporation / registration uploaded", done: hasDoc("incorporation_certificate") },
    { label: "Company PAN card uploaded", done: hasDoc("pan_card") },
  ];
  if (c.gstApplicable) {
    checks.splice(3, 0, { label: "GST number", done: filled(c.gstNumber) });
    checks.push({ label: "GST registration certificate uploaded", done: hasDoc("gst_certificate") });
  }
  return checks;
}

export function isReadyForVerification(checks: VerificationCheck[]): boolean {
  return checks.every((c) => c.done);
}
