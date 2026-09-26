// Commercial model (README §11 and §18). Candidates never pay; companies choose a plan.

export type PlanCode = "success" | "subscription" | "hybrid";

export type Plan = {
  code: PlanCode;
  name: string;
  tagline: string;
  monthlyPrice: number; // INR, excl. GST
  placementFeePercent: number; // % of the candidate's first-year CTC
  guaranteeDays: number; // fee becomes due after the candidate completes this many days
  replacementDays: number; // free replacement / refund window after joining
  activeJobLimit: number | null;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    code: "success",
    name: "Success Fee",
    tagline: "Pay only after your hire completes 60 days",
    monthlyPrice: 0,
    placementFeePercent: 8.33,
    guaranteeDays: 60,
    replacementDays: 90,
    activeJobLimit: 5,
    features: [
      "Up to 5 active jobs",
      "Pre-screened, verified candidates",
      "Fee = 8.33% of first-year CTC",
      "No fee if the candidate leaves within 60 days",
      "Free replacement within 90 days",
    ],
  },
  {
    code: "subscription",
    name: "Subscription",
    tagline: "Unlimited hiring for a flat monthly fee",
    monthlyPrice: 14999,
    placementFeePercent: 0,
    guaranteeDays: 60,
    replacementDays: 0,
    activeJobLimit: null,
    features: [
      "Unlimited active jobs",
      "No placement fees",
      "Candidate search & smart matching",
      "Recruiter workspace for your whole team",
      "Annual billing: 2 months free",
    ],
  },
  {
    code: "hybrid",
    name: "Hybrid",
    tagline: "Low subscription + reduced placement fee",
    monthlyPrice: 4999,
    placementFeePercent: 4,
    guaranteeDays: 60,
    replacementDays: 60,
    activeJobLimit: 15,
    features: [
      "Up to 15 active jobs",
      "Fee = 4% of first-year CTC after 60 days",
      "Free replacement within 60 days",
      "Priority support",
    ],
  },
];

export function getPlan(code: string | null | undefined): Plan {
  return PLANS.find((p) => p.code === code) ?? PLANS[0];
}

export type ServiceCode =
  | "priority_job"
  | "featured_employer"
  | "bulk_hiring"
  | "pro_screening"
  | "background_verification"
  | "video_interviews"
  | "recruitment_assistance"
  | "resume_db"
  | "dedicated_recruiter";

export type Service = {
  code: ServiceCode;
  name: string;
  description: string;
  price: number; // INR, excl. GST
  unit: string;
  needsJob?: boolean;
};

export const SERVICES: Service[] = [
  { code: "priority_job", name: "Priority job posting", description: "Pin a job to the top of search results and matches for 30 days.", price: 1999, unit: "per job", needsJob: true },
  { code: "featured_employer", name: "Featured employer", description: "Highlight your company on the job board and company listings for 30 days.", price: 4999, unit: "per month" },
  { code: "bulk_hiring", name: "Bulk hiring drive", description: "Dedicated campaign for 20+ positions with batch screening and interview slots.", price: 24999, unit: "per drive", needsJob: true },
  { code: "pro_screening", name: "Professional candidate screening", description: "Our recruiters phone-screen applicants before they reach your pipeline.", price: 999, unit: "per candidate", needsJob: true },
  { code: "background_verification", name: "Background verification", description: "Third-party verification of identity, education, employment and address.", price: 1499, unit: "per candidate" },
  { code: "video_interviews", name: "Video interviews", description: "Branded video interview rooms with recording for your team.", price: 2999, unit: "per month" },
  { code: "recruitment_assistance", name: "Recruitment assistance", description: "A platform recruiter sources and shortlists candidates for a role.", price: 9999, unit: "per role", needsJob: true },
  { code: "resume_db", name: "Resume database access", description: "Extended search across all consenting candidates, including passive ones.", price: 7999, unit: "per month" },
  { code: "dedicated_recruiter", name: "Dedicated recruiter", description: "A full-time recruiter embedded with your hiring team.", price: 39999, unit: "per month" },
];

export function getService(code: string): Service | undefined {
  return SERVICES.find((s) => s.code === code);
}
