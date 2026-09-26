import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const bool = (name: string) => integer(name, { mode: "boolean" });
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// ─── Identity ────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["candidate", "company", "admin"] }).notNull(),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  violationCount: integer("violation_count").notNull().default(0),
  notifyEmail: bool("notify_email").notNull().default(true),
  notifySms: bool("notify_sms").notNull().default(false),
  notifyWhatsapp: bool("notify_whatsapp").notNull().default(false),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Companies ───────────────────────────────────────────────────────────────

export const companies = sqliteTable("companies", {
  id: id(),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  registrationNumber: text("registration_number"),
  gstApplicable: bool("gst_applicable").notNull().default(true),
  gstNumber: text("gst_number"),
  pan: text("pan"),
  addressLine: text("address_line"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("India"),
  pincode: text("pincode"),
  website: text("website"),
  businessEmail: text("business_email").notNull(),
  contactName: text("contact_name"),
  contactDesignation: text("contact_designation"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  industry: text("industry"),
  size: text("size"),
  hiringRequirements: text("hiring_requirements"),
  description: text("description"),
  billingName: text("billing_name"),
  billingAddress: text("billing_address"),
  billingEmail: text("billing_email"),
  billingGstNumber: text("billing_gst_number"),
  verificationStatus: text("verification_status", { enum: ["unverified", "pending", "verified", "rejected"] })
    .notNull()
    .default("unverified"),
  verificationNote: text("verification_note"),
  verificationSubmittedAt: ts("verification_submitted_at"),
  verifiedAt: ts("verified_at"),
  maskedEmail: text("masked_email").notNull().unique(),
  planCode: text("plan_code").notNull().default("success"),
  billingCycle: text("billing_cycle", { enum: ["monthly", "annual"] }).notNull().default("monthly"),
  subscriptionRenewsAt: ts("subscription_renews_at"),
  featuredUntil: ts("featured_until"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const companyMembers = sqliteTable(
  "company_members",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["hr_admin", "recruiter", "hiring_manager", "interviewer"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("company_members_user_unique").on(t.userId), index("company_members_company_idx").on(t.companyId)],
);

export const companyInvites = sqliteTable("company_invites", {
  id: id(),
  companyId: text("company_id").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["hr_admin", "recruiter", "hiring_manager", "interviewer"] }).notNull(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
  invitedByUserId: text("invited_by_user_id").notNull(),
  acceptedAt: ts("accepted_at"),
  createdAt: createdAt(),
});

// ─── Candidates ──────────────────────────────────────────────────────────────

export const candidates = sqliteTable(
  "candidates",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    headline: text("headline"),
    summary: text("summary"),
    photoKey: text("photo_key"),
    dateOfBirth: text("date_of_birth"),
    gender: text("gender"),
    currentLocation: text("current_location"),
    preferredLocations: json<string[]>("preferred_locations").notNull().default([]),
    industry: text("industry"),
    currentCompany: text("current_company"),
    currentDesignation: text("current_designation"),
    experienceYears: real("experience_years").notNull().default(0),
    currentCtc: real("current_ctc"), // LPA
    expectedCtc: real("expected_ctc"), // LPA
    noticePeriodDays: integer("notice_period_days"),
    availability: text("availability", { enum: ["immediate", "within_30", "over_30", "not_looking"] })
      .notNull()
      .default("within_30"),
    workModePreference: text("work_mode_preference", { enum: ["remote", "hybrid", "onsite", "any"] })
      .notNull()
      .default("any"),
    skills: json<string[]>("skills").notNull().default([]),
    languages: json<string[]>("languages").notNull().default([]),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    otherProfileUrl: text("other_profile_url"),
    maskedEmail: text("masked_email").notNull().unique(),
    identityVerifiedAt: ts("identity_verified_at"),
    educationVerifiedAt: ts("education_verified_at"),
    experienceVerifiedAt: ts("experience_verified_at"),
    salaryVerifiedAt: ts("salary_verified_at"),
    locationVerifiedAt: ts("location_verified_at"),
    level1QualifiedAt: ts("level1_qualified_at"),
    level1Score: integer("level1_score"),
    level2QualifiedAt: ts("level2_qualified_at"),
    level2Category: text("level2_category"),
    level2Score: integer("level2_score"),
    profileVisibility: text("profile_visibility", { enum: ["all_verified", "applied_only", "hidden"] })
      .notNull()
      .default("all_verified"),
    appearInSearch: bool("appear_in_search").notNull().default(true),
    allowRecruiterContact: bool("allow_recruiter_contact").notNull().default(true),
    allowRecommendations: bool("allow_recommendations").notNull().default(true),
    shareableDocTypes: json<string[]>("shareable_doc_types").notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("candidates_industry_idx").on(t.industry)],
);

export const educations = sqliteTable("educations", {
  id: id(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  degree: text("degree").notNull(),
  fieldOfStudy: text("field_of_study"),
  institution: text("institution").notNull(),
  startYear: integer("start_year"),
  endYear: integer("end_year"),
  grade: text("grade"),
  createdAt: createdAt(),
});

export const experiences = sqliteTable("experiences", {
  id: id(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  startDate: text("start_date").notNull(), // YYYY-MM
  endDate: text("end_date"),
  isCurrent: bool("is_current").notNull().default(false),
  description: text("description"),
  createdAt: createdAt(),
});

export const certifications = sqliteTable("certifications", {
  id: id(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  issuer: text("issuer"),
  year: integer("year"),
  credentialUrl: text("credential_url"),
  createdAt: createdAt(),
});

export const projects = sqliteTable("projects", {
  id: id(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url"),
  createdAt: createdAt(),
});

// Verification & compliance documents for both companies and candidates.
export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    ownerType: text("owner_type", { enum: ["company", "candidate"] }).notNull(),
    ownerId: text("owner_id").notNull(),
    docType: text("doc_type").notNull(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("documents_owner_idx").on(t.ownerType, t.ownerId), index("documents_status_idx").on(t.status)],
);

// ─── Jobs ────────────────────────────────────────────────────────────────────

export type MandatoryRequirements = {
  experience?: boolean; // candidate must meet job.minExperience
  noticePeriod?: boolean; // candidate notice must be <= job.maxNoticePeriodDays
  education?: boolean; // candidate must meet job.educationLevel
  minCurrentCtc?: number | null; // candidate current CTC must be >= this (LPA)
  requireLevel1?: boolean;
  requireLevel2?: boolean;
  requireIdentityVerified?: boolean;
};

export const jobs = sqliteTable(
  "jobs",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    postedByUserId: text("posted_by_user_id").notNull(),
    title: text("title").notNull(),
    department: text("department"),
    industry: text("industry").notNull(),
    location: text("location").notNull(),
    workMode: text("work_mode", { enum: ["remote", "hybrid", "onsite"] }).notNull(),
    employmentType: text("employment_type", { enum: ["full_time", "part_time", "contract", "internship", "temporary"] }).notNull(),
    minExperience: real("min_experience").notNull().default(0),
    maxExperience: real("max_experience"),
    educationLevel: text("education_level").notNull().default("any"),
    requiredSkills: json<string[]>("required_skills").notNull().default([]),
    preferredSkills: json<string[]>("preferred_skills").notNull().default([]),
    description: text("description").notNull(),
    responsibilities: text("responsibilities"),
    minCtc: real("min_ctc"), // LPA
    maxCtc: real("max_ctc"), // LPA
    incentives: text("incentives"),
    benefits: text("benefits"),
    vacancies: integer("vacancies").notNull().default(1),
    joiningWithinDays: integer("joining_within_days"),
    maxNoticePeriodDays: integer("max_notice_period_days"),
    interviewProcess: text("interview_process"),
    interviewRequirements: text("interview_requirements"),
    mandatory: json<MandatoryRequirements>("mandatory").notNull().default({}),
    status: text("status", { enum: ["draft", "pending_approval", "active", "paused", "closed", "rejected", "suspended"] })
      .notNull()
      .default("draft"),
    moderationNote: text("moderation_note"),
    priorityUntil: ts("priority_until"),
    viewCount: integer("view_count").notNull().default(0),
    publishedAt: ts("published_at"),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_company_idx").on(t.companyId), index("jobs_status_idx").on(t.status)],
);

export const savedJobs = sqliteTable(
  "saved_jobs",
  {
    id: id(),
    candidateId: text("candidate_id").notNull(),
    jobId: text("job_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("saved_jobs_unique").on(t.candidateId, t.jobId)],
);

export const jobReports = sqliteTable("job_reports", {
  id: id(),
  jobId: text("job_id").notNull(),
  reporterUserId: text("reporter_user_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
  resolvedAt: ts("resolved_at"),
  createdAt: createdAt(),
});

// ─── Resumes ─────────────────────────────────────────────────────────────────

export const RESUME_SECTIONS = ["summary", "skills", "experience", "education", "certifications", "projects", "languages"] as const;
export type ResumeSection = (typeof RESUME_SECTIONS)[number];

export const resumes = sqliteTable("resumes", {
  id: id(),
  candidateId: text("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  template: text("template", { enum: ["classic", "modern", "compact", "executive"] }).notNull().default("classic"),
  targetRole: text("target_role"),
  headline: text("headline"),
  summary: text("summary"),
  skills: json<string[]>("skills").notNull().default([]),
  sections: json<ResumeSection[]>("sections").notNull().default([...RESUME_SECTIONS]),
  targetJobId: text("target_job_id"),
  isDefault: bool("is_default").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Applications & interviews ───────────────────────────────────────────────

export const APPLICATION_STAGE_VALUES = [
  "applied",
  "screening",
  "shortlisted",
  "assessment",
  "interview_1",
  "interview_2",
  "hr_interview",
  "selected",
  "offer",
  "joined",
  "rejected",
  "withdrawn",
] as const;

export const applications = sqliteTable(
  "applications",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull(),
    resumeId: text("resume_id"),
    uploadedResumeDocId: text("uploaded_resume_doc_id"),
    coverNote: text("cover_note"),
    stage: text("stage", { enum: APPLICATION_STAGE_VALUES }).notNull().default("applied"),
    source: text("source", { enum: ["direct", "platform_match", "company_invite", "find_jobs_for_me"] })
      .notNull()
      .default("direct"),
    matchScore: integer("match_score"),
    rejectionReason: text("rejection_reason"),
    firstResponseAt: ts("first_response_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("applications_job_candidate_unique").on(t.jobId, t.candidateId),
    index("applications_company_idx").on(t.companyId),
    index("applications_candidate_idx").on(t.candidateId),
  ],
);

export const applicationEvents = sqliteTable(
  "application_events",
  {
    id: id(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStage: text("from_stage"),
    toStage: text("to_stage").notNull(),
    actorUserId: text("actor_user_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId)],
);

export const interviews = sqliteTable(
  "interviews",
  {
    id: id(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    title: text("title").notNull(),
    scheduledAt: ts("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    mode: text("mode", { enum: ["video", "phone", "onsite"] }).notNull(),
    meetingUrl: text("meeting_url"),
    location: text("location"),
    interviewerUserId: text("interviewer_user_id"),
    status: text("status", { enum: ["scheduled", "completed", "cancelled", "no_show"] }).notNull().default("scheduled"),
    notes: text("notes"),
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    reminderSentAt: ts("reminder_sent_at"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("interviews_application_idx").on(t.applicationId), index("interviews_scheduled_idx").on(t.scheduledAt)],
);

export const interviewFeedback = sqliteTable("interview_feedback", {
  id: id(),
  interviewId: text("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").notNull(),
  technical: integer("technical").notNull(),
  communication: integer("communication").notNull(),
  roleFit: integer("role_fit").notNull(),
  experience: integer("experience").notNull(),
  salaryNotes: text("salary_notes"),
  availabilityNotes: text("availability_notes"),
  strengths: text("strengths"),
  concerns: text("concerns"),
  recommendation: text("recommendation", { enum: ["strong_yes", "yes", "maybe", "no"] }).notNull(),
  aiSummary: text("ai_summary"),
  aiSummarySource: text("ai_summary_source", { enum: ["rules", "claude"] }),
  createdAt: createdAt(),
});

// ─── Assessments ─────────────────────────────────────────────────────────────

export const assessments = sqliteTable("assessments", {
  id: id(),
  level: integer("level").notNull(), // 1 = aptitude, 2 = industry/role
  category: text("category").notNull(), // "general" for level 1, industry value for level 2
  title: text("title").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull().default(20),
  passingPercent: integer("passing_percent").notNull().default(60),
  questionsPerAttempt: integer("questions_per_attempt").notNull().default(10),
  retakeCooldownDays: integer("retake_cooldown_days").notNull().default(7),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const questions = sqliteTable(
  "questions",
  {
    id: id(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    text: text("text").notNull(),
    options: json<string[]>("options").notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation"),
    isActive: bool("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("questions_assessment_idx").on(t.assessmentId)],
);

export type TopicBreakdown = Record<string, { correct: number; total: number }>;

export const assessmentAttempts = sqliteTable(
  "assessment_attempts",
  {
    id: id(),
    assessmentId: text("assessment_id").notNull(),
    candidateId: text("candidate_id").notNull(),
    questionIds: json<string[]>("question_ids").notNull(),
    answers: json<Record<string, number>>("answers").notNull().default({}),
    startedAt: ts("started_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
    submittedAt: ts("submitted_at"),
    scorePercent: integer("score_percent"),
    passed: bool("passed"),
    status: text("status", { enum: ["in_progress", "submitted", "expired"] }).notNull().default("in_progress"),
    topicBreakdown: json<TopicBreakdown>("topic_breakdown"),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_candidate_idx").on(t.candidateId), index("attempts_assessment_idx").on(t.assessmentId)],
);

// ─── Matching & "Find Jobs For Me" ──────────────────────────────────────────

export const findJobsRequests = sqliteTable("find_jobs_requests", {
  id: id(),
  candidateId: text("candidate_id").notNull().unique(),
  desiredRole: text("desired_role").notNull(),
  preferredLocations: json<string[]>("preferred_locations").notNull().default([]),
  expectedCtc: real("expected_ctc"),
  experienceYears: real("experience_years"),
  preferredIndustry: text("preferred_industry"),
  workMode: text("work_mode", { enum: ["remote", "hybrid", "onsite", "any"] }).notNull().default("any"),
  joiningAvailabilityDays: integer("joining_availability_days"),
  applyMode: text("apply_mode", { enum: ["ask_first", "auto_apply"] }).notNull().default("ask_first"),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
  notes: text("notes"),
  lastMatchedAt: ts("last_matched_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type MatchReason = { factor: string; status: "match" | "partial" | "mismatch"; detail: string };

export const recommendations = sqliteTable(
  "recommendations",
  {
    id: id(),
    candidateId: text("candidate_id").notNull(),
    jobId: text("job_id").notNull(),
    source: text("source", { enum: ["auto_match", "recruitment_team", "company_invite"] }).notNull(),
    score: integer("score").notNull(),
    reasons: json<MatchReason[]>("reasons").notNull().default([]),
    status: text("status", { enum: ["pending", "accepted", "declined", "applied"] }).notNull().default("pending"),
    message: text("message"),
    createdByUserId: text("created_by_user_id"),
    respondedAt: ts("responded_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("recommendations_unique").on(t.candidateId, t.jobId), index("recommendations_candidate_idx").on(t.candidateId)],
);

// ─── Privacy-protected communication ────────────────────────────────────────

export const conversations = sqliteTable(
  "conversations",
  {
    id: id(),
    companyId: text("company_id").notNull(),
    candidateId: text("candidate_id").notNull(),
    jobId: text("job_id"),
    applicationId: text("application_id"),
    subject: text("subject").notNull(),
    status: text("status", { enum: ["open", "blocked", "closed"] }).notNull().default("open"),
    lastMessageAt: ts("last_message_at"),
    createdAt: createdAt(),
  },
  (t) => [index("conversations_company_idx").on(t.companyId), index("conversations_candidate_idx").on(t.candidateId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderRole: text("sender_role", { enum: ["company", "candidate", "system"] }).notNull(),
    senderUserId: text("sender_user_id"),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    body: text("body").notNull(), // as delivered (redacted if needed)
    originalBody: text("original_body"), // kept only when redacted; visible to admins
    flagged: bool("flagged").notNull().default(false),
    flagReasons: json<string[]>("flag_reasons").notNull().default([]),
    moderationStatus: text("moderation_status", { enum: ["none", "pending_review", "dismissed", "actioned"] })
      .notNull()
      .default("none"),
    channel: text("channel", { enum: ["in_app", "email"] }).notNull().default("in_app"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId), index("messages_flagged_idx").on(t.flagged)],
);

export const mailRelayLog = sqliteTable("mail_relay_log", {
  id: id(),
  messageId: text("message_id"),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  maskedFrom: text("masked_from").notNull(),
  maskedTo: text("masked_to").notNull(),
  realRecipient: text("real_recipient"),
  subject: text("subject"),
  status: text("status", { enum: ["delivered", "logged", "failed", "rejected"] }).notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const notificationDeliveries = sqliteTable("notification_deliveries", {
  id: id(),
  notificationId: text("notification_id").notNull(),
  userId: text("user_id").notNull(),
  channel: text("channel", { enum: ["email", "sms", "whatsapp"] }).notNull(),
  destination: text("destination"),
  status: text("status", { enum: ["sent", "logged", "failed", "skipped"] }).notNull(),
  provider: text("provider").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

// ─── Placements & billing ────────────────────────────────────────────────────

export const placements = sqliteTable(
  "placements",
  {
    id: id(),
    applicationId: text("application_id").notNull().unique(),
    companyId: text("company_id").notNull(),
    candidateId: text("candidate_id").notNull(),
    jobId: text("job_id").notNull(),
    planCode: text("plan_code").notNull(),
    selectedAt: ts("selected_at").notNull(),
    offeredCtc: real("offered_ctc"), // LPA
    expectedJoiningDate: ts("expected_joining_date"),
    joiningDate: ts("joining_date"),
    guaranteeDays: integer("guarantee_days").notNull().default(60),
    replacementDays: integer("replacement_days").notNull().default(90),
    milestoneDate: ts("milestone_date"),
    status: text("status", { enum: ["pending_joining", "in_guarantee", "fee_due", "completed", "fee_waived", "cancelled"] })
      .notNull()
      .default("pending_joining"),
    leftAt: ts("left_at"),
    leftReason: text("left_reason"),
    replacementStatus: text("replacement_status", { enum: ["none", "eligible", "requested", "fulfilled", "refunded"] })
      .notNull()
      .default("none"),
    feeAmount: integer("fee_amount"),
    invoiceId: text("invoice_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("placements_company_idx").on(t.companyId), index("placements_status_idx").on(t.status)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    number: text("number").notNull().unique(),
    companyId: text("company_id").notNull(),
    placementId: text("placement_id"),
    serviceRequestId: text("service_request_id"),
    kind: text("kind", { enum: ["placement_fee", "subscription", "service"] }).notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    taxAmount: integer("tax_amount").notNull(),
    total: integer("total").notNull(),
    status: text("status", { enum: ["issued", "paid", "overdue", "void", "refunded"] }).notNull().default("issued"),
    issuedAt: ts("issued_at").notNull(),
    dueAt: ts("due_at").notNull(),
    paidAt: ts("paid_at"),
    periodStart: ts("period_start"),
    periodEnd: ts("period_end"),
    createdAt: createdAt(),
  },
  (t) => [index("invoices_company_idx").on(t.companyId), index("invoices_status_idx").on(t.status)],
);

export const payments = sqliteTable("payments", {
  id: id(),
  invoiceId: text("invoice_id").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  recordedByUserId: text("recorded_by_user_id"),
  createdAt: createdAt(),
});

export const serviceRequests = sqliteTable("service_requests", {
  id: id(),
  companyId: text("company_id").notNull(),
  serviceCode: text("service_code").notNull(),
  jobId: text("job_id"),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
  status: text("status", { enum: ["requested", "in_progress", "fulfilled", "cancelled"] }).notNull().default("requested"),
  invoiceId: text("invoice_id"),
  requestedByUserId: text("requested_by_user_id").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Audit ───────────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: json<Record<string, unknown>>("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)],
);

export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type CompanyMember = typeof companyMembers.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Education = typeof educations.$inferSelect;
export type Experience = typeof experiences.$inferSelect;
export type Certification = typeof certifications.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type InterviewFeedback = typeof interviewFeedback.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type AssessmentAttempt = typeof assessmentAttempts.$inferSelect;
export type Placement = typeof placements.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
