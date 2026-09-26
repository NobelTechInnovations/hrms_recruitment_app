// Demo data covering every module in the README. Run with `npm run db:seed`
// (or `npm run db:reset` to wipe and re-create the database first).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import * as s from "../src/db/schema";
import { hashPassword } from "../src/server/password";
import { milestoneDate } from "../src/lib/billing";
import { getPlan } from "../src/lib/plans";
import { summarizeFeedbackRules } from "../src/lib/interview-summary";
import { ASSESSMENTS } from "./seed-data/questions";

const PASSWORD = "Password@123";
const DAY = 86_400_000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
/** A date `offset` days from today at hh:mm India time. */
function istAt(offset: number, hh: number, mm = 0): Date {
  const d = new Date(now.getTime() + offset * DAY);
  const ist = new Date(d.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hh, mm) - 330 * 60_000);
}

function demoPdf(title: string, owner: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A5", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(9).fillColor("#b91c1c").text("DEMO DOCUMENT — NOT A REAL RECORD", { align: "center" });
    doc.moveDown(2).fontSize(18).fillColor("#111827").text(title, { align: "center" });
    doc.moveDown().fontSize(12).fillColor("#374151").text(owner, { align: "center" });
    doc.end();
  });
}

async function addDocument(ownerType: "company" | "candidate", ownerId: string, ownerName: string, docType: string, label: string, status: "pending" | "approved" | "rejected", adminId: string | null) {
  const storageKey = `documents/${crypto.randomUUID()}.pdf`;
  const root = path.resolve(process.env.STORAGE_DIR ?? "./storage/uploads");
  mkdirSync(path.join(root, "documents"), { recursive: true });
  const buf = await demoPdf(label, ownerName);
  writeFileSync(path.join(root, storageKey), buf);
  await db.insert(s.documents).values({
    ownerType,
    ownerId,
    docType,
    fileName: `${docType}.pdf`,
    storageKey,
    mimeType: "application/pdf",
    sizeBytes: buf.length,
    status,
    reviewedByUserId: status === "pending" ? null : adminId,
    reviewedAt: status === "pending" ? null : daysAgo(20),
    createdAt: daysAgo(25),
  });
}

async function createUser(email: string, name: string, role: s.User["role"], extra: Partial<typeof s.users.$inferInsert> = {}) {
  const [u] = await db
    .insert(s.users)
    .values({ email, name, role, passwordHash: await hashPassword(PASSWORD), createdAt: daysAgo(60), ...extra })
    .returning();
  return u!;
}

async function main() {
  const [existing] = await db.select({ n: sql<number>`count(*)` }).from(s.users);
  if (Number(existing?.n ?? 0) > 0) {
    console.log("Database already has data — skipping seed. Run `npm run db:reset` to start fresh.");
    return;
  }

  // ─── Assessments ─────────────────────────────────────────────────────────
  const assessmentIds: Record<string, string> = {};
  const questionIds: Record<string, string[]> = {};
  for (const a of ASSESSMENTS) {
    const [row] = await db
      .insert(s.assessments)
      .values({ level: a.level, category: a.category, title: a.title, description: a.description, durationMinutes: a.durationMinutes, passingPercent: a.passingPercent, questionsPerAttempt: a.questionsPerAttempt })
      .returning();
    assessmentIds[a.category] = row!.id;
    const qs = await db
      .insert(s.questions)
      .values(a.questions.map((q) => ({ assessmentId: row!.id, topic: q.topic, text: q.text, options: q.options, correctIndex: q.correct, explanation: q.explanation ?? null })))
      .returning({ id: s.questions.id, topic: s.questions.topic });
    questionIds[a.category] = qs.map((q) => q.id);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────
  const admin = await createUser("admin@panel.com", "Platform Admin", "admin");

  // ─── Companies ───────────────────────────────────────────────────────────
  async function createCompany(opts: {
    owner: { email: string; name: string };
    company: Partial<typeof s.companies.$inferInsert> & { name: string; maskedEmail: string; businessEmail: string };
    members?: { email: string; name: string; role: s.CompanyMember["role"] }[];
    docs: { type: string; label: string; status: "pending" | "approved" }[];
  }) {
    const owner = await createUser(opts.owner.email, opts.owner.name, "company", { phone: "+919800000001" });
    const [company] = await db
      .insert(s.companies)
      .values({ ownerUserId: owner.id, country: "India", createdAt: daysAgo(55), ...opts.company })
      .returning();
    await db.insert(s.companyMembers).values({ companyId: company!.id, userId: owner.id, role: "hr_admin" });
    const members: Record<string, s.User> = { [opts.owner.email]: owner };
    for (const m of opts.members ?? []) {
      const u = await createUser(m.email, m.name, "company");
      await db.insert(s.companyMembers).values({ companyId: company!.id, userId: u.id, role: m.role });
      members[m.email] = u;
    }
    for (const d of opts.docs) await addDocument("company", company!.id, company!.name, d.type, d.label, d.status, admin.id);
    return { company: company!, members };
  }

  const xyz = await createCompany({
    owner: { email: "hr@xyzsoft.com", name: "Ananya Sharma" },
    company: {
      name: "XYZ Softech Pvt Ltd",
      legalName: "XYZ Softech Private Limited",
      registrationNumber: "U72900KA2015PTC081234",
      gstApplicable: true,
      gstNumber: "29AABCX1234F1Z5",
      pan: "AABCX1234F",
      addressLine: "4th Floor, Prestige Tech Park, Outer Ring Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560103",
      website: "https://xyzsoft.example.com",
      businessEmail: "hr@xyzsoft.com",
      contactName: "Ananya Sharma",
      contactDesignation: "Head of Talent Acquisition",
      contactPhone: "+91 98450 00000",
      contactEmail: "hr@xyzsoft.com",
      industry: "it",
      size: "201-500",
      hiringRequirements: "Scaling our product engineering team: backend, frontend and DevOps engineers across Bengaluru, Pune and Hyderabad.",
      description: "XYZ Softech builds cloud-native SaaS products for logistics and supply-chain companies across India and Southeast Asia.",
      billingName: "XYZ Softech Private Limited",
      billingAddress: "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103",
      billingEmail: "accounts@xyzsoft.com",
      billingGstNumber: "29AABCX1234F1Z5",
      verificationStatus: "verified",
      verificationSubmittedAt: daysAgo(50),
      verifiedAt: daysAgo(48),
      maskedEmail: "hr_53543@panel.com",
      planCode: "success",
    },
    members: [
      { email: "recruiter@xyzsoft.com", name: "Rohit Verma", role: "recruiter" },
      { email: "manager@xyzsoft.com", name: "Sanjay Iyer", role: "hiring_manager" },
      { email: "interviewer@xyzsoft.com", name: "Divya Nair", role: "interviewer" },
    ],
    docs: [
      { type: "incorporation_certificate", label: "Certificate of Incorporation", status: "approved" },
      { type: "pan_card", label: "Company PAN Card", status: "approved" },
      { type: "gst_certificate", label: "GST Registration Certificate", status: "approved" },
    ],
  });

  const finedge = await createCompany({
    owner: { email: "talent@finedge.in", name: "Meera Kapoor" },
    company: {
      name: "FinEdge Capital Advisors LLP",
      legalName: "FinEdge Capital Advisors LLP",
      registrationNumber: "AAB-1234",
      gstApplicable: true,
      gstNumber: "27AAGFF5678K1Z2",
      pan: "AAGFF5678K",
      addressLine: "12th Floor, One BKC, Bandra Kurla Complex",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      website: "https://finedge.example.com",
      businessEmail: "talent@finedge.in",
      contactName: "Meera Kapoor",
      contactDesignation: "HR Manager",
      contactPhone: "+91 98200 00000",
      industry: "finance",
      size: "51-200",
      hiringRequirements: "Analysts, accountants and relationship managers for our advisory and wealth practices.",
      description: "Independent financial advisory firm serving mid-market companies and HNI families.",
      billingName: "FinEdge Capital Advisors LLP",
      billingAddress: "12th Floor, One BKC, Mumbai 400051",
      billingEmail: "finance@finedge.in",
      verificationStatus: "verified",
      verificationSubmittedAt: daysAgo(40),
      verifiedAt: daysAgo(39),
      maskedEmail: "hr_61207@panel.com",
      planCode: "hybrid",
      billingCycle: "monthly",
      subscriptionRenewsAt: new Date(now.getTime() - 60_000),
    },
    docs: [
      { type: "incorporation_certificate", label: "LLP Incorporation Certificate", status: "approved" },
      { type: "pan_card", label: "LLP PAN Card", status: "approved" },
      { type: "gst_certificate", label: "GST Registration Certificate", status: "approved" },
    ],
  });

  const bright = await createCompany({
    owner: { email: "hr@brightretail.in", name: "Arvind Rao" },
    company: {
      name: "BrightRetail India Pvt Ltd",
      registrationNumber: "U52100MH2019PTC320011",
      gstApplicable: true,
      gstNumber: "27AAHCB4321L1Z9",
      pan: "AAHCB4321L",
      addressLine: "Plot 22, Hinjewadi Phase 1",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411057",
      website: "https://brightretail.example.com",
      businessEmail: "hr@brightretail.in",
      contactName: "Arvind Rao",
      contactDesignation: "HR Business Partner",
      contactPhone: "+91 99220 00000",
      industry: "sales",
      size: "1000+",
      hiringRequirements: "Store managers and inside-sales teams for 40 new stores.",
      description: "Omnichannel consumer-electronics retailer with 120 stores across western India.",
      billingName: "BrightRetail India Pvt Ltd",
      billingAddress: "Plot 22, Hinjewadi Phase 1, Pune 411057",
      billingEmail: "ap@brightretail.in",
      verificationStatus: "pending",
      verificationSubmittedAt: daysAgo(1),
      maskedEmail: "hr_70418@panel.com",
    },
    docs: [
      { type: "incorporation_certificate", label: "Certificate of Incorporation", status: "pending" },
      { type: "pan_card", label: "Company PAN Card", status: "pending" },
      { type: "gst_certificate", label: "GST Registration Certificate", status: "pending" },
    ],
  });

  // ─── Candidates ──────────────────────────────────────────────────────────
  type CandidateSeed = {
    email: string;
    masked: string;
    profile: Partial<typeof s.candidates.$inferInsert> & { fullName: string };
    educations: Omit<typeof s.educations.$inferInsert, "candidateId">[];
    experiences: Omit<typeof s.experiences.$inferInsert, "candidateId">[];
    certifications?: Omit<typeof s.certifications.$inferInsert, "candidateId">[];
    projects?: Omit<typeof s.projects.$inferInsert, "candidateId">[];
    docs: [string, "pending" | "approved"][];
    l1?: number;
    l2?: [string, number];
  };

  const DOC_LABELS: Record<string, string> = {
    identity_proof: "Aadhaar Card",
    address_proof: "Address Proof",
    education_certificate: "Degree Certificate",
    experience_letter: "Experience Letter",
    salary_slip: "Salary Slip",
    professional_certification: "Certification",
    resume: "Resume",
  };

  async function createCandidate(c: CandidateSeed) {
    const user = await createUser(c.email, c.profile.fullName, "candidate", { phone: "+919876500000" });
    const verified = (type: string) => c.docs.some(([t, st]) => t === type && st === "approved");
    const [cand] = await db
      .insert(s.candidates)
      .values({
        userId: user.id,
        maskedEmail: c.masked,
        createdAt: daysAgo(45),
        identityVerifiedAt: verified("identity_proof") ? daysAgo(20) : null,
        locationVerifiedAt: verified("address_proof") ? daysAgo(20) : null,
        educationVerifiedAt: verified("education_certificate") ? daysAgo(20) : null,
        experienceVerifiedAt: verified("experience_letter") ? daysAgo(20) : null,
        salaryVerifiedAt: verified("salary_slip") ? daysAgo(20) : null,
        level1QualifiedAt: c.l1 && c.l1 >= 60 ? daysAgo(30) : null,
        level1Score: c.l1 ?? null,
        level2QualifiedAt: c.l2 ? daysAgo(25) : null,
        level2Category: c.l2?.[0] ?? null,
        level2Score: c.l2?.[1] ?? null,
        ...c.profile,
      })
      .returning();
    const candidateId = cand!.id;
    if (c.educations.length) await db.insert(s.educations).values(c.educations.map((e) => ({ ...e, candidateId })));
    if (c.experiences.length) await db.insert(s.experiences).values(c.experiences.map((e) => ({ ...e, candidateId })));
    if (c.certifications?.length) await db.insert(s.certifications).values(c.certifications.map((e) => ({ ...e, candidateId })));
    if (c.projects?.length) await db.insert(s.projects).values(c.projects.map((e) => ({ ...e, candidateId })));
    for (const [type, status] of c.docs) await addDocument("candidate", candidateId, c.profile.fullName, type, DOC_LABELS[type] ?? type, status, admin.id);

    const attempt = async (category: string, score: number, when: Date) => {
      const ids = questionIds[category]!.slice(0, category === "general" ? 10 : 8);
      await db.insert(s.assessmentAttempts).values({
        assessmentId: assessmentIds[category]!,
        candidateId,
        questionIds: ids,
        answers: {},
        startedAt: when,
        expiresAt: new Date(when.getTime() + 15 * 60_000),
        submittedAt: new Date(when.getTime() + 11 * 60_000),
        scorePercent: score,
        passed: score >= 60,
        status: "submitted",
      });
    };
    if (c.l1) await attempt("general", c.l1, daysAgo(30));
    if (c.l2) await attempt(c.l2[0], c.l2[1], daysAgo(25));
    return { user, candidate: cand! };
  }

  const asha = await createCandidate({
    email: "asha@example.com",
    masked: "candidate_82731@panel.com",
    profile: {
      fullName: "Asha Rao",
      headline: "Senior Backend Engineer · Node.js, TypeScript, AWS",
      summary:
        "Backend engineer with 5 years of experience building high-throughput APIs and event-driven systems for logistics SaaS. Led the migration of a monolith to services on AWS, cutting p95 latency by 40%. Enjoys mentoring and clean, well-tested code.",
      dateOfBirth: "1995-04-12",
      gender: "female",
      currentLocation: "Bengaluru",
      preferredLocations: ["Bengaluru", "Hyderabad"],
      industry: "it",
      currentCompany: "Nimbus Technologies",
      currentDesignation: "Senior Software Engineer",
      experienceYears: 5,
      currentCtc: 14,
      expectedCtc: 20,
      noticePeriodDays: 30,
      availability: "within_30",
      workModePreference: "hybrid",
      skills: ["Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker", "React", "Redis"],
      languages: ["English", "Hindi", "Kannada"],
      linkedinUrl: "https://www.linkedin.com/in/asha-rao-demo",
      portfolioUrl: "https://github.com/asha-rao-demo",
      shareableDocTypes: ["experience_letter", "education_certificate"],
    },
    educations: [{ level: "graduate", degree: "B.Tech, Computer Science", fieldOfStudy: "Computer Science", institution: "RV College of Engineering", startYear: 2013, endYear: 2017, grade: "8.6 CGPA" }],
    experiences: [
      {
        company: "Nimbus Technologies",
        title: "Senior Software Engineer",
        location: "Bengaluru",
        startDate: "2021-06",
        isCurrent: true,
        description: "Own the shipment-tracking platform (40M events/day) on Node.js, Kafka and PostgreSQL.\nLed the monolith-to-services migration on AWS ECS; p95 latency down 40%.\nMentor 4 engineers; introduced contract testing across teams.",
      },
      {
        company: "Cartwheel Labs",
        title: "Software Engineer",
        location: "Bengaluru",
        startDate: "2017-07",
        endDate: "2021-05",
        description: "Built REST APIs and admin dashboards (Node.js, React) for a B2B ordering product.\nReduced infrastructure cost by 25% by consolidating services and adding Redis caching.",
      },
    ],
    certifications: [{ name: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", year: 2022 }],
    projects: [{ name: "Open-source rate limiter", description: "Redis-backed sliding-window rate limiter for Express with 1k+ GitHub stars.", url: "https://github.com/asha-rao-demo/limiter" }],
    docs: [
      ["identity_proof", "approved"],
      ["address_proof", "approved"],
      ["education_certificate", "approved"],
      ["experience_letter", "approved"],
      ["salary_slip", "approved"],
    ],
    l1: 85,
    l2: ["it", 88],
  });

  const rahul = await createCandidate({
    email: "rahul@example.com",
    masked: "candidate_40562@panel.com",
    profile: {
      fullName: "Rahul Mehta",
      headline: "Frontend Developer · React & TypeScript",
      summary: "Frontend developer with 3 years of experience shipping accessible, fast React applications for fintech and e-commerce.",
      dateOfBirth: "1998-09-02",
      currentLocation: "Pune",
      preferredLocations: ["Pune", "Mumbai"],
      industry: "it",
      currentCompany: "PixelKart",
      currentDesignation: "Frontend Developer",
      experienceYears: 3,
      currentCtc: 8,
      expectedCtc: 11,
      noticePeriodDays: 15,
      availability: "within_30",
      skills: ["React", "TypeScript", "Next.js", "CSS", "JavaScript", "Jest"],
      languages: ["English", "Hindi", "Marathi"],
      linkedinUrl: "https://www.linkedin.com/in/rahul-mehta-demo",
    },
    educations: [{ level: "graduate", degree: "B.E., Information Technology", institution: "Pune Institute of Computer Technology", startYear: 2016, endYear: 2020 }],
    experiences: [{ company: "PixelKart", title: "Frontend Developer", location: "Pune", startDate: "2021-08", isCurrent: true, description: "Rebuilt checkout in Next.js; conversion up 12%. Built a shared component library used by 5 teams." }],
    docs: [
      ["identity_proof", "approved"],
      ["education_certificate", "pending"],
    ],
    l1: 72,
  });

  const priya = await createCandidate({
    email: "priya@example.com",
    masked: "candidate_19384@panel.com",
    profile: {
      fullName: "Priya Nair",
      headline: "Financial Analyst · FP&A, Modelling, Power BI",
      summary: "MBA (Finance) with 4 years in FP&A and financial modelling for mid-market companies. Built board-level dashboards and 3-statement models that supported two fundraises.",
      dateOfBirth: "1996-01-20",
      currentLocation: "Mumbai",
      preferredLocations: ["Mumbai", "Pune"],
      industry: "finance",
      currentCompany: "Arcadia Consulting",
      currentDesignation: "Senior Financial Analyst",
      experienceYears: 4,
      currentCtc: 9,
      expectedCtc: 12,
      noticePeriodDays: 60,
      availability: "over_30",
      skills: ["Financial Modelling", "Excel", "Power BI", "GST", "Tally", "Valuation"],
      languages: ["English", "Malayalam", "Hindi"],
      linkedinUrl: "https://www.linkedin.com/in/priya-nair-demo",
    },
    educations: [
      { level: "postgraduate", degree: "MBA, Finance", institution: "NMIMS Mumbai", startYear: 2018, endYear: 2020 },
      { level: "graduate", degree: "B.Com", institution: "St. Xavier's College, Mumbai", startYear: 2015, endYear: 2018 },
    ],
    experiences: [{ company: "Arcadia Consulting", title: "Senior Financial Analyst", location: "Mumbai", startDate: "2020-07", isCurrent: true, description: "Own monthly MIS and forecasting for 6 clients; built 3-statement models used in two fundraises." }],
    docs: [
      ["identity_proof", "approved"],
      ["education_certificate", "approved"],
      ["experience_letter", "approved"],
      ["salary_slip", "pending"],
    ],
    l1: 78,
    l2: ["finance", 81],
  });

  const vikram = await createCandidate({
    email: "vikram@example.com",
    masked: "candidate_57219@panel.com",
    profile: {
      fullName: "Vikram Singh",
      headline: "B2B Sales Manager · SaaS & Financial Services",
      summary: "Six years closing mid-market B2B deals; consistently 110%+ of quota.",
      currentLocation: "Delhi",
      preferredLocations: ["Delhi", "Gurugram", "Noida"],
      industry: "sales",
      currentCompany: "Zentrix Solutions",
      currentDesignation: "Sales Manager",
      experienceYears: 6,
      currentCtc: 10,
      expectedCtc: 13,
      noticePeriodDays: 0,
      availability: "immediate",
      skills: ["B2B Sales", "Negotiation", "CRM", "Lead Generation", "Salesforce"],
      languages: ["English", "Hindi", "Punjabi"],
    },
    educations: [{ level: "graduate", degree: "BBA", institution: "Delhi University", startYear: 2012, endYear: 2015 }],
    experiences: [{ company: "Zentrix Solutions", title: "Sales Manager", location: "Delhi", startDate: "2019-04", endDate: "2026-08", description: "Managed a ₹6 Cr annual book across 40 accounts; built a 4-person inside-sales team." }],
    docs: [["identity_proof", "pending"]],
    l1: 65,
  });

  const neha = await createCandidate({
    email: "neha@example.com",
    masked: "candidate_66310@panel.com",
    profile: {
      fullName: "Neha Gupta",
      headline: "HR Executive · Talent Acquisition",
      summary: "HR generalist with 2 years across end-to-end recruitment, onboarding and HRMS administration for a 300-person company.",
      currentLocation: "Pune",
      preferredLocations: ["Pune", "Bengaluru"],
      industry: "hr",
      currentCompany: "Stellar Foods",
      currentDesignation: "HR Executive",
      experienceYears: 2,
      currentCtc: 5,
      expectedCtc: 6.5,
      noticePeriodDays: 30,
      availability: "within_30",
      skills: ["Recruitment", "Onboarding", "HRMS", "Employee Relations", "Excel"],
      languages: ["English", "Hindi"],
    },
    educations: [{ level: "postgraduate", degree: "MBA, Human Resources", institution: "Symbiosis Pune", startYear: 2021, endYear: 2023 }],
    experiences: [{ company: "Stellar Foods", title: "HR Executive", location: "Pune", startDate: "2023-06", isCurrent: true, description: "Hire ~15 roles per quarter; cut time-to-hire from 38 to 24 days." }],
    docs: [
      ["identity_proof", "approved"],
      ["education_certificate", "approved"],
    ],
    l1: 70,
    l2: ["hr", 75],
  });

  const arjun = await createCandidate({
    email: "arjun@example.com",
    masked: "candidate_30975@panel.com",
    profile: {
      fullName: "Arjun Das",
      headline: "Computer Science graduate · Python & SQL",
      currentLocation: "Kolkata",
      preferredLocations: ["Anywhere"],
      industry: "it",
      experienceYears: 0,
      expectedCtc: 4.5,
      availability: "immediate",
      workModePreference: "remote",
      skills: ["Python", "SQL", "JavaScript", "Git"],
      languages: ["English", "Bengali", "Hindi"],
    },
    educations: [{ level: "graduate", degree: "B.Sc, Computer Science", institution: "Jadavpur University", startYear: 2022, endYear: 2025 }],
    experiences: [],
    projects: [{ name: "Attendance tracker", description: "Flask + SQLite app used by 200 students in my college.", url: null }],
    docs: [],
  });

  const kavya = await createCandidate({
    email: "kavya@example.com",
    masked: "candidate_71846@panel.com",
    profile: {
      fullName: "Kavya Reddy",
      headline: "DevOps Lead · Kubernetes, AWS, Terraform",
      summary: "Seven years running production Kubernetes platforms on AWS. Built CI/CD for 60+ services and led SOC 2 infrastructure controls.",
      currentLocation: "Hyderabad",
      preferredLocations: ["Hyderabad", "Bengaluru"],
      industry: "it",
      currentCompany: "Orbitly",
      currentDesignation: "DevOps Lead",
      experienceYears: 7,
      currentCtc: 22,
      expectedCtc: 27,
      noticePeriodDays: 90,
      availability: "over_30",
      skills: ["Kubernetes", "AWS", "Terraform", "Docker", "CI/CD", "Linux", "Prometheus"],
      languages: ["English", "Telugu", "Hindi"],
      profileVisibility: "applied_only",
    },
    educations: [{ level: "graduate", degree: "B.Tech, Electronics", institution: "JNTU Hyderabad", startYear: 2012, endYear: 2016 }],
    experiences: [{ company: "Orbitly", title: "DevOps Lead", location: "Hyderabad", startDate: "2020-01", isCurrent: true, description: "Run 14 EKS clusters; cut deploy time from 40 to 8 minutes." }],
    docs: [
      ["identity_proof", "approved"],
      ["address_proof", "approved"],
      ["education_certificate", "approved"],
      ["experience_letter", "approved"],
      ["salary_slip", "approved"],
    ],
    l1: 90,
    l2: ["it", 92],
  });

  // Candidates already placed (for 60-day tracking).
  const sneha = await createCandidate({
    email: "sneha@example.com",
    masked: "candidate_24680@panel.com",
    profile: { fullName: "Sneha Kulkarni", headline: "Frontend Developer", currentLocation: "Pune", industry: "it", experienceYears: 3, currentCtc: 11, expectedCtc: 12, availability: "not_looking", skills: ["React", "TypeScript", "CSS"], languages: ["English"] },
    educations: [{ level: "graduate", degree: "B.E., Computer Engineering", institution: "COEP Pune", endYear: 2021 }],
    experiences: [],
    docs: [["identity_proof", "approved"]],
    l1: 74,
  });
  const imran = await createCandidate({
    email: "imran@example.com",
    masked: "candidate_13579@panel.com",
    profile: { fullName: "Imran Sheikh", headline: "Accounts Executive", currentLocation: "Mumbai", industry: "finance", experienceYears: 2, currentCtc: 5.5, expectedCtc: 5.5, availability: "not_looking", skills: ["Tally", "GST", "Excel"], languages: ["English", "Hindi", "Urdu"] },
    educations: [{ level: "graduate", degree: "B.Com", institution: "Mumbai University", endYear: 2022 }],
    experiences: [],
    docs: [["identity_proof", "approved"]],
    l1: 68,
  });

  // ─── Resumes ─────────────────────────────────────────────────────────────
  await db.insert(s.resumes).values([
    { candidateId: asha.candidate.id, title: "Backend Resume", template: "modern", targetRole: "Senior Backend Engineer", headline: "Senior Backend Engineer", summary: asha.candidate.summary, skills: ["Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker", "Redis"], isDefault: true },
    { candidateId: asha.candidate.id, title: "Full-Stack Resume", template: "classic", targetRole: "Full-Stack Engineer", headline: "Full-Stack Engineer · Node.js & React", summary: "Full-stack engineer comfortable across Node.js services and React frontends.", skills: ["Node.js", "React", "TypeScript", "PostgreSQL"], sections: ["summary", "skills", "experience", "projects", "education", "certifications"] },
    { candidateId: rahul.candidate.id, title: "Frontend Resume", template: "compact", headline: "Frontend Developer", summary: rahul.candidate.summary, skills: rahul.candidate.skills, isDefault: true },
    { candidateId: priya.candidate.id, title: "Finance Resume", template: "executive", headline: "Financial Analyst", summary: priya.candidate.summary, skills: priya.candidate.skills, isDefault: true },
    { candidateId: kavya.candidate.id, title: "DevOps Resume", template: "modern", headline: "DevOps Lead", summary: kavya.candidate.summary, skills: kavya.candidate.skills, isDefault: true },
  ]);

  // ─── Jobs ────────────────────────────────────────────────────────────────
  async function createJob(companyId: string, postedBy: string, j: Partial<typeof s.jobs.$inferInsert> & { title: string; industry: string; location: string; workMode: s.Job["workMode"]; description: string }, publishedDaysAgo = 10) {
    const [job] = await db
      .insert(s.jobs)
      .values({
        companyId,
        postedByUserId: postedBy,
        employmentType: "full_time",
        status: "active",
        publishedAt: daysAgo(publishedDaysAgo),
        createdAt: daysAgo(publishedDaysAgo + 1),
        ...j,
      })
      .returning();
    return job!;
  }
  const xyzHr = xyz.members["hr@xyzsoft.com"]!.id;
  const xyzRecruiter = xyz.members["recruiter@xyzsoft.com"]!.id;
  const interviewer = xyz.members["interviewer@xyzsoft.com"]!.id;
  const manager = xyz.members["manager@xyzsoft.com"]!.id;
  const finHr = finedge.members["talent@finedge.in"]!.id;

  const jBackend = await createJob(xyz.company.id, xyzRecruiter, {
    title: "Senior Backend Engineer (Node.js)",
    department: "Platform Engineering",
    industry: "it",
    location: "Bengaluru",
    workMode: "hybrid",
    minExperience: 4,
    maxExperience: 8,
    educationLevel: "graduate",
    requiredSkills: ["Node.js", "TypeScript", "PostgreSQL", "AWS"],
    preferredSkills: ["Docker", "Kafka"],
    description: "Design and build the event-driven services behind our shipment-tracking platform, processing 40M+ events a day.",
    responsibilities: "Own services end-to-end from design to production\nImprove reliability and performance of core APIs\nMentor engineers and review code",
    minCtc: 16,
    maxCtc: 24,
    incentives: "Annual performance bonus up to 15%",
    benefits: "Health insurance for family, ESOPs, learning budget ₹50,000/yr, 2 days WFH",
    vacancies: 2,
    joiningWithinDays: 30,
    maxNoticePeriodDays: 30,
    interviewProcess: "Screening call → Technical interview 1 (system design) → Technical interview 2 (coding) → HR interview",
    interviewRequirements: "Laptop with a working camera for the coding round.",
    mandatory: { experience: true, education: true, noticePeriod: true, requireLevel1: true },
    priorityUntil: new Date(now.getTime() + 20 * DAY),
  }, 12);
  const jFrontend = await createJob(xyz.company.id, xyzRecruiter, {
    title: "Frontend Developer (React)",
    department: "Product Engineering",
    industry: "it",
    location: "Pune",
    workMode: "hybrid",
    minExperience: 2,
    maxExperience: 5,
    educationLevel: "graduate",
    requiredSkills: ["React", "TypeScript", "CSS"],
    preferredSkills: ["Next.js", "Jest"],
    description: "Build delightful, accessible interfaces for our logistics dashboards used by 5,000+ operators daily.",
    responsibilities: "Ship features in React/TypeScript\nOwn performance and accessibility\nCollaborate with designers",
    minCtc: 8,
    maxCtc: 14,
    benefits: "Health insurance, flexible hours, hybrid work",
    vacancies: 2,
    joiningWithinDays: 30,
    interviewProcess: "Take-home exercise → Technical interview → HR interview",
    mandatory: { experience: true },
  }, 90);
  const jDevops = await createJob(xyz.company.id, xyzHr, {
    title: "DevOps Engineer",
    department: "Infrastructure",
    industry: "it",
    location: "Hyderabad",
    workMode: "onsite",
    minExperience: 5,
    maxExperience: 10,
    educationLevel: "graduate",
    requiredSkills: ["Kubernetes", "AWS", "Terraform", "CI/CD"],
    preferredSkills: ["Prometheus", "Linux"],
    description: "Run and scale our Kubernetes platform on AWS across three regions.",
    minCtc: 20,
    maxCtc: 30,
    vacancies: 1,
    joiningWithinDays: 90,
    maxNoticePeriodDays: 90,
    mandatory: { experience: true, noticePeriod: true, requireLevel2: true },
  }, 30);
  const jTrainee = await createJob(xyz.company.id, xyzRecruiter, {
    title: "Graduate Software Trainee",
    department: "Engineering",
    industry: "it",
    location: "Remote",
    workMode: "remote",
    minExperience: 0,
    maxExperience: 1,
    educationLevel: "graduate",
    requiredSkills: ["Python", "SQL"],
    preferredSkills: ["JavaScript", "Git"],
    description: "A 6-month paid training programme leading to a full-time software engineer role.",
    minCtc: 3.5,
    maxCtc: 5,
    vacancies: 5,
    joiningWithinDays: 15,
    mandatory: { education: true },
  }, 4);
  const jHr = await createJob(xyz.company.id, xyzHr, {
    title: "HR Executive — Talent Acquisition",
    department: "People",
    industry: "hr",
    location: "Bengaluru",
    workMode: "onsite",
    minExperience: 1,
    maxExperience: 4,
    educationLevel: "graduate",
    requiredSkills: ["Recruitment", "Onboarding", "HRMS"],
    preferredSkills: ["Employee Relations"],
    description: "Run end-to-end hiring for engineering and business roles.",
    minCtc: 4,
    maxCtc: 7,
    vacancies: 1,
    joiningWithinDays: 45,
  }, 8);
  const jAnalyst = await createJob(finedge.company.id, finHr, {
    title: "Financial Analyst",
    department: "Advisory",
    industry: "finance",
    location: "Mumbai",
    workMode: "hybrid",
    minExperience: 3,
    maxExperience: 6,
    educationLevel: "postgraduate",
    requiredSkills: ["Financial Modelling", "Excel", "Power BI"],
    preferredSkills: ["GST", "Valuation"],
    description: "Build models and MIS for mid-market advisory clients; present insights to CFOs.",
    minCtc: 10,
    maxCtc: 15,
    incentives: "Quarterly bonus",
    benefits: "Health insurance, CFA sponsorship",
    vacancies: 1,
    joiningWithinDays: 60,
    maxNoticePeriodDays: 60,
    mandatory: { education: true, minCurrentCtc: 5, requireLevel2: true },
  }, 9);
  const jAccounts = await createJob(finedge.company.id, finHr, {
    title: "Accounts Executive (GST & TDS)",
    department: "Finance Operations",
    industry: "finance",
    location: "Mumbai",
    workMode: "onsite",
    minExperience: 1,
    maxExperience: 3,
    educationLevel: "graduate",
    requiredSkills: ["Tally", "GST", "Excel"],
    description: "Manage GST returns, TDS filings and vendor reconciliation.",
    minCtc: 4,
    maxCtc: 6,
    vacancies: 1,
    joiningWithinDays: 30,
  }, 45);
  const jRm = await createJob(finedge.company.id, finHr, {
    title: "Relationship Manager — Wealth",
    department: "Wealth",
    industry: "sales",
    location: "Delhi",
    workMode: "onsite",
    minExperience: 3,
    maxExperience: 7,
    educationLevel: "graduate",
    requiredSkills: ["B2B Sales", "Negotiation", "CRM"],
    description: "Acquire and manage HNI relationships in the NCR region.",
    minCtc: 9,
    maxCtc: 14,
    incentives: "Uncapped quarterly incentives",
    vacancies: 2,
    joiningWithinDays: 30,
  }, 6);
  await createJob(finedge.company.id, finHr, {
    title: "Business Development Manager",
    department: "Advisory",
    industry: "sales",
    location: "Gurugram",
    workMode: "hybrid",
    minExperience: 4,
    maxExperience: 9,
    educationLevel: "graduate",
    requiredSkills: ["B2B Sales", "Lead Generation", "Negotiation"],
    preferredSkills: ["Salesforce"],
    description: "Grow our advisory practice across mid-market companies in North India.",
    minCtc: 11,
    maxCtc: 16,
    vacancies: 1,
    joiningWithinDays: 30,
  }, 2);
  const jStore = await createJob(bright.company.id, bright.members["hr@brightretail.in"]!.id, {
    title: "Store Operations Manager",
    industry: "sales",
    location: "Pune",
    workMode: "onsite",
    minExperience: 5,
    maxExperience: 10,
    requiredSkills: ["Retail Operations", "Team Management", "P&L"],
    description: "Run a flagship 12,000 sq ft store with a team of 35.",
    minCtc: 8,
    maxCtc: 12,
    vacancies: 3,
    status: "pending_approval",
    publishedAt: null,
  });
  await createJob(bright.company.id, bright.members["hr@brightretail.in"]!.id, {
    title: "Inside Sales Associate",
    industry: "sales",
    location: "Pune",
    workMode: "onsite",
    minExperience: 0,
    maxExperience: 2,
    requiredSkills: ["Communication", "CRM"],
    description: "Convert online leads into store visits and orders.",
    minCtc: 3,
    maxCtc: 4.5,
    status: "draft",
    publishedAt: null,
  });

  // ─── Applications ────────────────────────────────────────────────────────
  async function createApplication(opts: { job: s.Job; candidateId: string; candidateUserId: string; stages: string[]; startDaysAgo: number; source?: s.Application["source"]; matchScore: number; actorUserId: string; rejectionReason?: string }) {
    const start = daysAgo(opts.startDaysAgo);
    const [resume] = await db.select({ id: s.resumes.id }).from(s.resumes).where(eq(s.resumes.candidateId, opts.candidateId)).limit(1);
    const finalStage = opts.stages[opts.stages.length - 1]!;
    const [app] = await db
      .insert(s.applications)
      .values({
        jobId: opts.job.id,
        candidateId: opts.candidateId,
        companyId: opts.job.companyId,
        resumeId: resume?.id ?? null,
        coverNote: "I'd love to bring my experience to your team — happy to share more in an interview.",
        stage: finalStage as s.Application["stage"],
        source: opts.source ?? "direct",
        matchScore: opts.matchScore,
        rejectionReason: opts.rejectionReason ?? null,
        firstResponseAt: opts.stages.length > 1 ? new Date(start.getTime() + 20 * 3_600_000) : null,
        createdAt: start,
        updatedAt: daysAgo(Math.max(0, opts.startDaysAgo - opts.stages.length)),
      })
      .returning();
    let prev: string | null = null;
    for (const [i, stage] of opts.stages.entries()) {
      await db.insert(s.applicationEvents).values({
        applicationId: app!.id,
        fromStage: prev,
        toStage: stage,
        actorUserId: i === 0 ? opts.candidateUserId : opts.actorUserId,
        createdAt: new Date(start.getTime() + i * Math.max(1, (opts.startDaysAgo * DAY) / (opts.stages.length + 1))),
      });
      prev = stage;
    }
    return app!;
  }

  const aAsha = await createApplication({ job: jBackend, candidateId: asha.candidate.id, candidateUserId: asha.user.id, stages: ["applied", "screening", "shortlisted", "interview_1", "interview_2"], startDaysAgo: 11, matchScore: 93, actorUserId: xyzRecruiter });
  await createApplication({ job: jFrontend, candidateId: rahul.candidate.id, candidateUserId: rahul.user.id, stages: ["applied", "screening", "shortlisted"], startDaysAgo: 5, matchScore: 90, actorUserId: xyzRecruiter });
  await createApplication({ job: jBackend, candidateId: rahul.candidate.id, candidateUserId: rahul.user.id, stages: ["applied", "rejected"], startDaysAgo: 9, matchScore: 54, actorUserId: xyzRecruiter, rejectionReason: "Does not meet the minimum 4 years of backend experience." });
  const aKavya = await createApplication({ job: jDevops, candidateId: kavya.candidate.id, candidateUserId: kavya.user.id, stages: ["applied", "screening", "shortlisted", "interview_1", "hr_interview", "selected", "offer"], startDaysAgo: 25, matchScore: 95, actorUserId: xyzHr });
  await createApplication({ job: jTrainee, candidateId: arjun.candidate.id, candidateUserId: arjun.user.id, stages: ["applied"], startDaysAgo: 2, matchScore: 80, actorUserId: xyzRecruiter });
  await createApplication({ job: jHr, candidateId: neha.candidate.id, candidateUserId: neha.user.id, stages: ["applied", "screening"], startDaysAgo: 4, matchScore: 88, actorUserId: xyzHr });
  const aPriya = await createApplication({ job: jAnalyst, candidateId: priya.candidate.id, candidateUserId: priya.user.id, stages: ["applied", "screening", "shortlisted", "interview_1"], startDaysAgo: 7, matchScore: 91, actorUserId: finHr });
  await createApplication({ job: jRm, candidateId: vikram.candidate.id, candidateUserId: vikram.user.id, stages: ["applied", "shortlisted"], startDaysAgo: 3, matchScore: 84, actorUserId: finHr });
  const aSneha = await createApplication({ job: jFrontend, candidateId: sneha.candidate.id, candidateUserId: sneha.user.id, stages: ["applied", "shortlisted", "interview_1", "hr_interview", "selected", "offer", "joined"], startDaysAgo: 100, matchScore: 89, actorUserId: xyzRecruiter });
  const aImran = await createApplication({ job: jAccounts, candidateId: imran.candidate.id, candidateUserId: imran.user.id, stages: ["applied", "shortlisted", "interview_1", "selected", "offer", "joined"], startDaysAgo: 50, matchScore: 86, actorUserId: finHr });

  // ─── Placements (60-day tracking) ────────────────────────────────────────
  const snehaJoined = daysAgo(70);
  await db.insert(s.placements).values({
    applicationId: aSneha.id,
    companyId: xyz.company.id,
    candidateId: sneha.candidate.id,
    jobId: jFrontend.id,
    planCode: "success",
    selectedAt: daysAgo(85),
    offeredCtc: 12,
    expectedJoiningDate: snehaJoined,
    joiningDate: snehaJoined,
    guaranteeDays: 60,
    replacementDays: getPlan("success").replacementDays,
    milestoneDate: milestoneDate(snehaJoined, 60),
    status: "in_guarantee",
  });
  const imranJoined = daysAgo(20);
  await db.insert(s.placements).values({
    applicationId: aImran.id,
    companyId: finedge.company.id,
    candidateId: imran.candidate.id,
    jobId: jAccounts.id,
    planCode: "hybrid",
    selectedAt: daysAgo(35),
    offeredCtc: 5.5,
    expectedJoiningDate: imranJoined,
    joiningDate: imranJoined,
    guaranteeDays: 60,
    replacementDays: getPlan("hybrid").replacementDays,
    milestoneDate: milestoneDate(imranJoined, 60),
    status: "in_guarantee",
  });
  await db.insert(s.placements).values({
    applicationId: aKavya.id,
    companyId: xyz.company.id,
    candidateId: kavya.candidate.id,
    jobId: jDevops.id,
    planCode: "success",
    selectedAt: daysAgo(6),
    offeredCtc: 27,
    expectedJoiningDate: new Date(now.getTime() + 60 * DAY),
    guaranteeDays: 60,
    replacementDays: 90,
    status: "pending_joining",
  });

  // ─── Interviews & feedback ───────────────────────────────────────────────
  const [ashaI1] = await db
    .insert(s.interviews)
    .values({
      applicationId: aAsha.id,
      stage: "interview_1",
      title: "Technical interview 1 — System design",
      scheduledAt: istAt(-5, 11),
      durationMinutes: 60,
      mode: "video",
      meetingUrl: "https://meet.jit.si/hrms-demo-asha-1",
      interviewerUserId: interviewer,
      status: "completed",
      createdByUserId: xyzRecruiter,
    })
    .returning();
  await db.insert(s.interviews).values({
    applicationId: aAsha.id,
    stage: "interview_2",
    title: "Technical interview 2 — Coding",
    scheduledAt: istAt(1, 11),
    durationMinutes: 60,
    mode: "video",
    meetingUrl: "https://meet.jit.si/hrms-demo-asha-2",
    interviewerUserId: interviewer,
    createdByUserId: xyzRecruiter,
  });
  const ashaFeedback = [
    { interviewTitle: "Technical interview 1", interviewer: "Divya Nair", technical: 5, communication: 4, roleFit: 5, experience: 4, recommendation: "strong_yes" as const, strengths: "Excellent event-driven design; clear trade-off reasoning", concerns: "Limited Kafka operations experience", salaryNotes: "Expects ~20 LPA", availabilityNotes: "30-day notice, can negotiate to 21 days" },
    { interviewTitle: "Technical interview 1", interviewer: "Sanjay Iyer", technical: 4, communication: 4, roleFit: 4, experience: 4, recommendation: "yes" as const, strengths: "Strong PostgreSQL knowledge and mentoring mindset", concerns: null, salaryNotes: null, availabilityNotes: null },
  ];
  for (const [i, f] of ashaFeedback.entries()) {
    await db.insert(s.interviewFeedback).values({
      interviewId: ashaI1!.id,
      authorUserId: i === 0 ? interviewer : manager,
      technical: f.technical,
      communication: f.communication,
      roleFit: f.roleFit,
      experience: f.experience,
      recommendation: f.recommendation,
      strengths: f.strengths,
      concerns: f.concerns,
      salaryNotes: f.salaryNotes,
      availabilityNotes: f.availabilityNotes,
      aiSummary: i === ashaFeedback.length - 1 ? summarizeFeedbackRules(ashaFeedback, { candidateName: "Asha Rao", jobTitle: jBackend.title }) : null,
      aiSummarySource: i === ashaFeedback.length - 1 ? "rules" : null,
    });
  }
  await db.insert(s.interviews).values({
    applicationId: aPriya.id,
    stage: "interview_1",
    title: "Interview 1 — Case study",
    scheduledAt: istAt(3, 15),
    durationMinutes: 45,
    mode: "video",
    meetingUrl: "https://meet.jit.si/hrms-demo-priya-1",
    interviewerUserId: finHr,
    createdByUserId: finHr,
  });
  const [kavyaHr] = await db
    .insert(s.interviews)
    .values({ applicationId: aKavya.id, stage: "hr_interview", title: "HR interview", scheduledAt: istAt(-9, 16), durationMinutes: 30, mode: "phone", interviewerUserId: xyzHr, status: "completed", createdByUserId: xyzHr })
    .returning();
  await db.insert(s.interviewFeedback).values({ interviewId: kavyaHr!.id, authorUserId: xyzHr, technical: 5, communication: 5, roleFit: 5, experience: 5, recommendation: "strong_yes", strengths: "Deep platform expertise; strong leadership examples", salaryNotes: "Accepted 27 LPA", availabilityNotes: "90-day notice; buy-out possible" });

  // ─── Messaging (through the relay) ───────────────────────────────────────
  const { getOrCreateConversation, postMessage } = await import("../src/server/messaging");
  const convAsha = await getOrCreateConversation({ companyId: xyz.company.id, candidateId: asha.candidate.id, jobId: jBackend.id, applicationId: aAsha.id, subject: jBackend.title });
  await postMessage({ conversationId: convAsha.id, senderRole: "company", senderUserId: xyzRecruiter, body: "Hi Asha, thanks for applying! The team loved your system-design round. We'd like to schedule the coding interview." });
  await postMessage({ conversationId: convAsha.id, senderRole: "candidate", senderUserId: asha.user.id, body: "Thank you, Rohit! Tomorrow at 11 AM works well for me." });
  await postMessage({ conversationId: convAsha.id, senderRole: "company", senderUserId: xyzRecruiter, body: "Perfect — you'll find the video link on your Interviews page. All the best!" });
  const convPriya = await getOrCreateConversation({ companyId: finedge.company.id, candidateId: priya.candidate.id, jobId: jAnalyst.id, applicationId: aPriya.id, subject: jAnalyst.title });
  await postMessage({ conversationId: convPriya.id, senderRole: "company", senderUserId: finHr, body: "Hello Priya, could you share a sample of a financial model you've built (with confidential data removed)?" });
  await postMessage({ conversationId: convPriya.id, senderRole: "candidate", senderUserId: priya.user.id, body: "Sure! It's easier to discuss on a call — reach me at priya.nair@gmail.com or +91 98200 12345 on WhatsApp." });

  // ─── Find Jobs For Me ────────────────────────────────────────────────────
  await db.insert(s.findJobsRequests).values({
    candidateId: vikram.candidate.id,
    desiredRole: "Sales Manager",
    preferredLocations: ["Delhi", "Gurugram", "Noida"],
    expectedCtc: 13,
    experienceYears: 6,
    preferredIndustry: "sales",
    workMode: "any",
    joiningAvailabilityDays: 0,
    applyMode: "ask_first",
  });

  // ─── Services, reports, misc ─────────────────────────────────────────────
  const { createInvoice } = await import("../src/server/invoices");
  const [sr] = await db.insert(s.serviceRequests).values({ companyId: xyz.company.id, serviceCode: "priority_job", jobId: jBackend.id, requestedByUserId: xyzHr, status: "fulfilled", createdAt: daysAgo(12) }).returning();
  const srInvoice = await createInvoice({ companyId: xyz.company.id, kind: "service", amount: 1999, description: "Priority job posting — Senior Backend Engineer (Node.js)", serviceRequestId: sr!.id, now: daysAgo(12) });
  await db.update(s.serviceRequests).set({ invoiceId: srInvoice.id }).where(eq(s.serviceRequests.id, sr!.id));
  const { recordPayment } = await import("../src/server/invoices");
  await recordPayment({ invoiceId: srInvoice.id, amount: srInvoice.total, method: "upi", reference: "UPI-DEMO-4471", recordedByUserId: admin.id });

  await db.insert(s.jobReports).values({ jobId: jStore.id, reporterUserId: vikram.user.id, reason: "Misleading information", details: "Salary range seems unrealistic for the role." });
  await db.insert(s.recommendations).values({
    candidateId: neha.candidate.id,
    jobId: jHr.id,
    source: "company_invite",
    score: 88,
    status: "applied",
    message: "Your profile looks like a great fit for our TA team.",
    createdByUserId: xyzHr,
    respondedAt: daysAgo(4),
  });

  // Run the scheduler once: generates the 60-day fee invoice, the subscription
  // invoice, interview reminders and Find-Jobs-For-Me recommendations.
  const { runScheduledJobs } = await import("../src/server/scheduled");
  const summary = await runScheduledJobs(now);

  console.log("\n✓ Seed complete", summary);
  console.log(`\nAll demo accounts use the password: ${PASSWORD}\n`);
  console.table([
    { role: "Admin", email: "admin@panel.com" },
    { role: "Company HR Admin (verified)", email: "hr@xyzsoft.com" },
    { role: "Company Recruiter", email: "recruiter@xyzsoft.com" },
    { role: "Company Hiring Manager", email: "manager@xyzsoft.com" },
    { role: "Company Interviewer", email: "interviewer@xyzsoft.com" },
    { role: "Company (verified, Hybrid plan)", email: "talent@finedge.in" },
    { role: "Company (pending verification)", email: "hr@brightretail.in" },
    { role: "Candidate — fully verified", email: "asha@example.com" },
    { role: "Candidate — frontend", email: "rahul@example.com" },
    { role: "Candidate — finance", email: "priya@example.com" },
    { role: "Candidate — Find Jobs For Me", email: "vikram@example.com" },
    { role: "Candidate — HR", email: "neha@example.com" },
    { role: "Candidate — fresher", email: "arjun@example.com" },
    { role: "Candidate — private profile", email: "kavya@example.com" },
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
