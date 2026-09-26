// Shared enumerations and display labels used across the platform.

export type Option<T extends string = string> = { value: T; label: string };

export const USER_ROLES = ["candidate", "company", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const INDUSTRIES = [
  { value: "it", label: "Information Technology" },
  { value: "finance", label: "Finance & Accounting" },
  { value: "sales", label: "Sales & Business Development" },
  { value: "hr", label: "Human Resources" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations & Supply Chain" },
  { value: "healthcare", label: "Healthcare" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export type Industry = (typeof INDUSTRIES)[number]["value"];

export const COMPANY_SIZES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "501-1000", label: "501–1,000 employees" },
  { value: "1000+", label: "1,000+ employees" },
] as const satisfies readonly Option[];

export const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const satisfies readonly Option[];
export type WorkMode = (typeof WORK_MODES)[number]["value"];

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
] as const satisfies readonly Option[];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

// Ordered from lowest to highest so the index doubles as a rank.
export const EDUCATION_LEVELS = [
  { value: "any", label: "Any / not required" },
  { value: "high_school", label: "High school (10+2)" },
  { value: "diploma", label: "Diploma" },
  { value: "graduate", label: "Graduate (Bachelor's)" },
  { value: "postgraduate", label: "Postgraduate (Master's / MBA)" },
  { value: "doctorate", label: "Doctorate (PhD)" },
] as const satisfies readonly Option[];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number]["value"];

export function educationRank(level: string | null | undefined): number {
  const idx = EDUCATION_LEVELS.findIndex((l) => l.value === level);
  return idx < 0 ? 0 : idx;
}

export const AVAILABILITY = [
  { value: "immediate", label: "Available immediately", emoji: "🟢" },
  { value: "within_30", label: "Available within 30 days", emoji: "🟡" },
  { value: "over_30", label: "Notice period > 30 days", emoji: "🟠" },
  { value: "not_looking", label: "Not currently looking", emoji: "🔴" },
] as const;
export type Availability = (typeof AVAILABILITY)[number]["value"];

export const GENDERS = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

// Hiring pipeline, in order. `rejected` and `withdrawn` are terminal side-exits.
export const PIPELINE_STAGES = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "assessment", label: "Assessment" },
  { value: "interview_1", label: "Interview 1" },
  { value: "interview_2", label: "Interview 2" },
  { value: "hr_interview", label: "HR Interview" },
  { value: "selected", label: "Selected" },
  { value: "offer", label: "Offer" },
  { value: "joined", label: "Joined" },
] as const satisfies readonly Option[];
export type PipelineStage = (typeof PIPELINE_STAGES)[number]["value"];
export const TERMINAL_STAGES = [
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
] as const satisfies readonly Option[];
export type ApplicationStage = PipelineStage | (typeof TERMINAL_STAGES)[number]["value"];
export const ALL_STAGES = [...PIPELINE_STAGES, ...TERMINAL_STAGES] as const;

export const INTERVIEW_STAGES: PipelineStage[] = ["screening", "assessment", "interview_1", "interview_2", "hr_interview"];

export const INTERVIEW_MODES = [
  { value: "video", label: "Video interview" },
  { value: "phone", label: "Phone call" },
  { value: "onsite", label: "On-site" },
] as const satisfies readonly Option[];

export const RECOMMENDATIONS = [
  { value: "strong_yes", label: "Strong yes" },
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
] as const satisfies readonly Option[];

export const COMPANY_ROLES = [
  { value: "hr_admin", label: "HR Admin" },
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "interviewer", label: "Interviewer" },
] as const satisfies readonly Option[];
export type CompanyRole = (typeof COMPANY_ROLES)[number]["value"];

export const COMPANY_DOC_TYPES = [
  { value: "incorporation_certificate", label: "Certificate of incorporation / registration" },
  { value: "pan_card", label: "Company PAN card" },
  { value: "gst_certificate", label: "GST registration certificate" },
  { value: "address_proof", label: "Office address proof" },
  { value: "authorization_letter", label: "Authorization letter for contact person" },
  { value: "other_compliance", label: "Other compliance document" },
] as const satisfies readonly Option[];

export const CANDIDATE_DOC_TYPES = [
  { value: "identity_proof", label: "Identity proof (Aadhaar / Passport / PAN / Voter ID)" },
  { value: "address_proof", label: "Address / location proof" },
  { value: "education_certificate", label: "Education certificate / marksheet" },
  { value: "experience_letter", label: "Experience / relieving letter" },
  { value: "employment_document", label: "Employment document (offer / appointment letter)" },
  { value: "salary_slip", label: "Salary slip" },
  { value: "salary_proof", label: "Current / last salary proof (Form 16, bank statement)" },
  { value: "professional_certification", label: "Professional certification" },
  { value: "resume", label: "Resume (uploaded file)" },
] as const satisfies readonly Option[];

export const VERIFICATION_KINDS = [
  { value: "identity", label: "Identity" },
  { value: "education", label: "Education" },
  { value: "experience", label: "Experience" },
  { value: "salary", label: "Salary" },
  { value: "location", label: "Location" },
] as const satisfies readonly Option[];
export type VerificationKind = (typeof VERIFICATION_KINDS)[number]["value"];

// Which approved candidate document proves which verification.
export const DOC_TYPE_VERIFIES: Record<string, VerificationKind | undefined> = {
  identity_proof: "identity",
  address_proof: "location",
  education_certificate: "education",
  experience_letter: "experience",
  employment_document: "experience",
  salary_slip: "salary",
  salary_proof: "salary",
};

export const PROFILE_VISIBILITY = [
  { value: "all_verified", label: "All verified companies" },
  { value: "applied_only", label: "Only companies I apply to" },
  { value: "hidden", label: "Hidden" },
] as const satisfies readonly Option[];

// Level 2 assessment tracks. The platform seeds IT, Finance, Sales and HR; admins can add more.
export const ASSESSMENT_CATEGORIES = [
  { value: "general", label: "General aptitude (Level 1)" },
  ...INDUSTRIES.filter((i) => i.value !== "other"),
] as const satisfies readonly Option[];

export const APPLICATION_SOURCES = [
  { value: "direct", label: "Direct application" },
  { value: "platform_match", label: "Platform match" },
  { value: "company_invite", label: "Company invitation" },
  { value: "find_jobs_for_me", label: "Find Jobs For Me" },
] as const satisfies readonly Option[];

export const PLACEMENT_STATUSES = [
  { value: "pending_joining", label: "Awaiting joining" },
  { value: "in_guarantee", label: "In 60-day period" },
  { value: "fee_due", label: "Fee invoiced" },
  { value: "completed", label: "Paid" },
  { value: "fee_waived", label: "Fee waived" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly Option[];

export const INVOICE_STATUSES = [
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
  { value: "refunded", label: "Refunded" },
] as const satisfies readonly Option[];

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer (NEFT/RTGS/IMPS)" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export function labelOf(options: readonly { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export const TAX_RATE = 0.18; // GST on platform fees
export const INVOICE_DUE_DAYS = 15;
