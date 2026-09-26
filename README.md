# hrms_recruitment_app
A verified talent marketplace where companies find pre-screened candidates and job seekers discover verified employment opportunities—without exposing personal contact information.

> The full product specification is kept unchanged below under **[Product specification](#product-specification)**. Everything in it is implemented in this repository — see the [feature map](#feature-map).

## Quick start

Requirements: Node.js 20.9+ (22 LTS recommended).

```bash
npm install
npm run setup        # creates ./data/hrms.db and loads demo data
npm run dev          # http://localhost:3000
```

All demo accounts use the password **`Password@123`**:

| Role | Email |
| --- | --- |
| Platform admin | `admin@panel.com` |
| Company HR admin (verified, Success Fee plan) | `hr@xyzsoft.com` |
| Company recruiter / hiring manager / interviewer | `recruiter@xyzsoft.com`, `manager@xyzsoft.com`, `interviewer@xyzsoft.com` |
| Company (verified, Hybrid plan) | `talent@finedge.in` |
| Company (verification pending) | `hr@brightretail.in` |
| Candidate — fully verified, Level 1 + 2 qualified | `asha@example.com` |
| Candidate — Find Jobs For Me active | `vikram@example.com` |
| Other candidates | `rahul@`, `priya@`, `neha@`, `arjun@`, `kavya@example.com` |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js dev server, production build, production server |
| `npm run setup` | `db:migrate` + `db:seed` |
| `npm run db:reset` | Delete the local database and uploads, migrate and seed again |
| `npm run db:generate` | Generate a new Drizzle migration after editing `src/db/schema.ts` |
| `npm run jobs` | Run scheduled jobs once (interview reminders, 60-day milestones → invoices, overdue invoices, subscription renewals, Level 2 nudges, Find-Jobs-For-Me matching) |
| `npm test` | Unit tests (Vitest) for matching, contact-leak guard, billing, pipeline, scoring, assessments |
| `npm run test:e2e` | End-to-end browser test of the main journeys against a running, freshly seeded app |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## Configuration

Copy `.env.example` to `.env.local`. Nothing is required for local development: without credentials, emails, SMS and WhatsApp messages are recorded in **Admin → Notification log**, and the Interview AI assistant uses its built-in summariser.

In production also set:
- `CRON_SECRET`, and call `POST /api/cron` with `Authorization: Bearer $CRON_SECRET` every 15 minutes.
- `RELAY_DOMAIN` + `RELAY_WEBHOOK_SECRET`, and point your mail provider's inbound webhook for `*@RELAY_DOMAIN` at `POST /api/mail/inbound` with JSON `{ from, to, subject, text }` and header `x-relay-secret`. This lets both sides reply to masked addresses straight from their inbox.
- `SMTP_URL`, `TWILIO_*` and optionally `ANTHROPIC_API_KEY`.
- `DATABASE_URL` (a libSQL/Turso URL, or a file on a persistent volume) and `STORAGE_DIR` on persistent storage.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS 4**, light and dark themes
- **Drizzle ORM** on **SQLite / libSQL** (`src/db/schema.ts`, migrations in `drizzle/`)
- Cookie sessions with scrypt password hashing; role-based access for candidates, companies (4 workspace roles) and admins
- `pdfkit` for resume PDFs, `nodemailer` / Twilio REST for notifications, `@anthropic-ai/sdk` for the optional AI assistant
- Vitest and Playwright

## Project structure

```
src/
  app/
    (public)/        landing, pricing, job discovery, job detail, company trust profile, login/register, invites
    (account)/       notifications, settings (all roles)
    candidate/       candidate CRM: profile, score, verification, assessments, resumes, matches,
                     Find Jobs For Me, applications, saved jobs, interviews, messages, privacy
    company/         onboarding + workspace: hiring CRM, jobs, pipeline, candidate search, interviews,
                     messages, company verification, recruiter workspace, billing & placements
    admin/           users, verification, jobs, assessments, recruitment, finance, communication, notification log
    api/             protected files/photos, resume PDF, interview .ics, cron, inbound mail relay
  actions/           server actions (auth, candidate, company, admin, account)
  server/            services: auth, applications/pipeline, matching, messaging relay, placements, invoices,
                     assessments, verification, notifications, scheduled jobs, resume PDF, access control
  lib/               pure domain logic: matching, profile score, contact guard, pipeline rules, billing,
                     assessment engine, interview summary, ICS, plans, permissions (unit-tested)
  components/        UI kit, badges, shell, forms
  db/                Drizzle schema and client
scripts/             migrate, seed (demo data + question bank), reset, run-jobs
tests/               unit tests; tests/e2e/smoke.mjs end-to-end journeys
```

## Feature map

| Spec section | Where it lives |
| --- | --- |
| 1. Company registration & verification | `/company/onboarding`, `/company/profile` (all compliance fields, documents, checklist, submit); **UNVERIFIED COMPANY** / **VERIFIED COMPANY ✓** badges everywhere; admin review at `/admin/verification` |
| Company dashboard | `/company` Hiring CRM plus the jobs, pipeline, search, interviews, messages and billing pages |
| 2. Job posting | `/company/jobs/new`: every listed field, plus mandatory requirements (min experience, max notice, education, minimum CTC, Level 1/2, verified identity). Jobs from unverified companies wait for admin approval |
| 3. Job seeker registration & verification | `/candidate/profile`, `/candidate/verification` (private documents, admin approval → badges); documents only visible to staff unless the candidate shares them |
| 4. Candidate screening | `/candidate/assessments`: timed Level 1 aptitude and Level 2 IT/Finance/Sales/HR tests, server-scored, random draw across topics, retake cooldown |
| 5. Candidate profile score | `/candidate/score`: completion %, verification, screening and professional checklists (no opaque AI score) |
| 6. Privacy-protected communication | Masked `hr_#####@panel.com` / `candidate_#####@panel.com` addresses, in-app threads, email relay both ways (`/api/mail/inbound`), phone/email/WhatsApp detection with redaction, admin moderation and relay logs |
| 7. Job discovery | `/jobs` filters for location, salary, experience, industry, job type, work mode, company, skills, education, verified companies and date posted. Flow: save → apply → track |
| 8. Smart job matching | Explainable scoring in `src/lib/matching.ts`; "N jobs match your profile" (`/candidate/matches`) and "N candidates match your job" (`/company/jobs/[id]/matches`) with reasons |
| 9. Find a Job for Me | `/candidate/find-jobs` preferences + consent (ask first or auto-apply); daily auto-matching; admin recruitment desk at `/admin/recruitment` |
| 10. Interview management | Pipeline Applied → … → Joined, scheduling with video links, `.ics`/Google Calendar, reminders, rescheduling, notes, structured feedback, history |
| 11. 60-day payment model | Placements track selected date, joining date, 60-day milestone, auto-invoice, payment status and replacement/refund eligibility (`/company/billing`, `/admin/finance`) |
| 12. Company hiring CRM | `/company`: open jobs, applications, shortlisted, interviews, offers, joined, plus a funnel |
| 13. Candidate CRM | `/candidate`: completion, application counts, recommended jobs, verification |
| 14. Resume builder | `/candidate/resumes`: multiple versions, 4 templates, section ordering, job-specific suggestions, live preview, PDF export |
| 15. Notifications | In-app + email + SMS + WhatsApp per user preference (`/settings`), all the example messages from the spec |
| 16. Admin panel | `/admin/*`: users, verification, jobs, assessments (question bank, passing criteria, analytics), recruitment, finance, communication |
| 17. Additional features | Verification levels (Basic → Fully Verified), company trust profile (`/companies/[id]`), availability, notice-period & CTC matching, Interview AI assistant, recruiter workspace with roles, candidate consent management (`/candidate/privacy`) |
| 18. Revenue model | Success Fee / Subscription / Hybrid plans and the optional services catalogue (`/pricing`, `/company/billing`) |
| 19. Overall platform flow | Covered end to end by `tests/e2e/smoke.mjs` |

---

# Product specification

HR Recruitment & Talent Marketplace — Product Description

A modern recruitment platform that connects verified companies with verified, pre-screened job seekers through a secure and privacy-focused hiring marketplace.

The platform works somewhat like an Upwork-style marketplace for recruitment: companies create verified profiles, publish detailed job opportunities, search and shortlist candidates, communicate through the platform, and schedule interviews. Job seekers create comprehensive professional profiles, verify their credentials, apply for jobs, build resumes, and can also allow the platform to proactively match them with suitable opportunities.

1. Company Registration & Verification

Companies can create an account and build their organization profile.

Company verification should include:

Company/organization name
Registration details
GST details where applicable
PAN / business identification
Company address
Official website
Business email
Contact person details
Company industry
Company size
Hiring requirements
Payment/billing details
Other required compliance documents

Until verification is completed, the company profile should clearly display:

UNVERIFIED COMPANY

After successful verification:

VERIFIED COMPANY ✓

Job seekers should be able to see the company's verification status before applying or interacting with a job.

Company Dashboard

Companies can:

Create and manage company profile
Post jobs
Define salary/CTC
Define experience requirements
Define education requirements
Add skills
Define location/work mode
Select employment type
Set number of vacancies
Add job description
Add interview requirements
Search candidates
Filter candidates
Shortlist candidates
Reject candidates
Schedule interviews
Manage interview stages
Communicate with candidates
Track applications
Manage hiring pipeline
Manage invoices and payments
2. Job Posting

Companies can create detailed job postings similar to a marketplace workflow.

Each job can contain:

Job Information

Job title
Department
Industry
Job location
Remote / Hybrid / On-site
Employment type
Experience range
Education requirement
Required skills
Preferred skills
Job description
Responsibilities
Salary/CTC range
Incentives
Benefits
Number of vacancies
Joining timeline
Notice-period requirement
Interview process

Companies can also define mandatory requirements such as:

Minimum 2 years experience
Maximum notice period 30 days
MBA/Graduate required
Minimum CTC ₹5 LPA

This allows the platform to automatically identify relevant candidates.

3. Job Seeker Registration & Verification

Job seekers create a professional profile and complete a verification process.

The profile can contain:

Name
Profile photo
Date of birth
Gender, where legally appropriate
Current location
Preferred location
Education
Certifications
Work experience
Current company
Previous companies
Skills
Languages
Current CTC
Expected CTC
Notice period
Employment history
Resume
Portfolio
LinkedIn/other professional profiles
Identity verification
Education verification
Employment verification
Verification Documents

Depending on the recruitment use case, candidates can submit:

Identity proof
Address/location verification
Education certificates
Experience letters
Salary slips
Current/last salary proof
Employment documents
Professional certifications

Sensitive documents should remain private and should only be accessible to authorized platform personnel or disclosed according to the candidate's consent.

Candidate profiles can display verification badges such as:

Identity Verified ✓
Education Verified ✓
Experience Verified ✓
Salary Verified ✓

4. Candidate Screening System

One of the biggest differentiators of the platform can be its pre-screening system.

Instead of companies receiving hundreds of completely unfiltered applications, candidates can pass through platform-level screening.

Level 1 — Aptitude & Basic Screening

Candidates take a platform-created assessment covering areas such as:

Logical reasoning
Quantitative aptitude
Communication
Basic problem solving
General professional skills

Candidates who meet the required score become:

Level 1 Qualified ✓

Level 2 — Industry/Role Assessment

The second assessment is customized according to the candidate's selected industry or career category.

For example:

IT

Programming
Database
Web development
System fundamentals

Finance

Accounting
Financial analysis
Excel
Tax fundamentals

Sales

Communication
Negotiation
Sales scenarios
Customer handling

HR

Recruitment
Employee relations
HR policies
Situational judgment

Candidates who qualify receive:

Level 2 Industry Qualified ✓

This gives companies additional information before they spend time interviewing candidates.

5. Candidate Profile Score

The platform can generate a transparent profile completeness/qualification view based on verified information.

For example:

Profile Completion: 92%

Verification

✓ Identity
✓ Education
✓ Experience
✓ Salary
✓ Location

Screening

✓ Aptitude Assessment
✓ Industry Assessment

Professional Profile

✓ Resume
✓ Skills
✓ Experience

Avoid presenting this as an opaque "AI hiring score." Instead, companies should be able to see specific verified qualifications and assessment results.

6. Privacy-Protected Communication

A major feature of the platform should be contact information protection.

Neither side initially gets the other's direct email address or phone number.

For example, if a company has:

hr@xyz.com

the platform generates a protected communication address such as:

hr_53543@panel.com

The job seeker communicates with the company through this address.

The platform routes the message to:

hr@xyz.com

without exposing the company's direct email address to the candidate.

The same system works for candidates.

Example

Candidate:

candidate_82731@panel.com

Company communicates with the candidate through the platform-generated address.

The platform handles:

Candidate → Panel → Company

and

Company → Panel → Candidate

This provides:

Privacy
Spam protection
Communication tracking
Abuse prevention
Audit history
Platform-level moderation

The platform should also scan messages for attempts to bypass the platform by sharing phone numbers, personal emails, WhatsApp numbers, etc., according to your terms and privacy policy.

7. Job Discovery

Job seekers can browse jobs using filters such as:

Location
Salary
Experience
Industry
Job type
Work mode
Company
Skills
Education
Verified companies
Date posted

They can:

Save Job → Apply → Track Application → Interview → Offer

8. Smart Job Matching

The platform can automatically match candidates with relevant jobs.

For example:

5 New Jobs Match Your Profile

Matching can consider:

Skills
Experience
Education
Location
Salary expectations
Notice period
Job preferences
Industry
Assessment qualification

Companies can similarly receive:

18 Candidates Match Your Job

with an explanation of why each candidate matches.

9. "Find a Job for Me" Service

This could become an important premium feature.

Instead of requiring candidates to search manually, they can activate:

Find Jobs For Me

The candidate specifies:

Desired role
Preferred location
Expected salary
Experience
Preferred industry
Remote/hybrid preference
Joining availability

The recruitment team/platform matching system can then identify suitable opportunities.

With the candidate's permission, the platform can:

Match → Recommend → Apply/Seek Consent → Schedule Interview

This creates a recruitment-assistance layer on top of the marketplace.

10. Interview Management

The platform should have a complete interview workflow.

Hiring Pipeline

Applied

↓

Screening

↓

Shortlisted

↓

Assessment

↓

Interview 1

↓

Interview 2

↓

HR Interview

↓

Selected

↓

Offer

↓

Joined

Companies can schedule interviews directly from the platform.

Features:

Interview scheduling
Calendar integration
Video interview
Interview reminders
Interview notes
Interview feedback
Candidate status
Rescheduling
Automated notifications
Interview history
11. 60-Day Company Payment Model

A strong differentiator is that companies don't pay immediately when they hire/post a candidate.

The platform can operate on a deferred recruitment fee model.

For example:

Company hires Candidate → Candidate joins → 60-day period begins → Platform generates recruitment fee after 60 days.

You could define your commercial model around:

Successful Placement Fee

rather than charging candidates.

The system should automatically track:

Candidate selected date
Joining date
Replacement period
60-day milestone
Invoice generation
Payment status
Refund/replacement eligibility

For example:

Candidate Joined: 1 September
60-Day Milestone: 31 October
Invoice: Generated according to company agreement

You should have different commercial plans for companies, because some employers may prefer subscriptions while others prefer placement-based pricing.

12. Company Hiring CRM

Each company should effectively get a mini recruitment CRM.

Dashboard

Open Jobs: 12
Applications: 486
Shortlisted: 72
Interviews: 28
Offers: 6
Joined: 4

The company can manage the entire recruitment pipeline from one place.

13. Candidate Recruitment CRM

Candidates also get their own dashboard.

Candidate Dashboard

Profile Completion: 94%

Applications

Applied — 12
Shortlisted — 4
Interviews — 2
Offers — 1

Recommended Jobs

8 new matches

Verification

Identity ✓
Education ✓
Experience ✓
14. Resume Builder

Candidates can create professional resumes directly inside the platform.

Features:

Multiple resume templates
Professional layouts
Different resume versions
Job-specific resume
PDF export
Resume preview
Resume completeness suggestions
Skills section
Experience section
Education section
Certifications
Projects
Languages

A candidate could maintain:

IT Resume
Management Resume
Sales Resume

and select the appropriate version when applying.

15. Notifications

Automated notifications through:

Email
SMS
WhatsApp
In-app notifications

Examples:

Your application has been shortlisted.

Your interview has been scheduled for tomorrow at 11:00 AM.

Your profile has matched 5 new jobs.

Company verification completed.

Please complete your Level 2 assessment.

16. Admin Panel

The platform admin should have complete control.

Admin Modules

Users

Job seekers
Companies
Recruiters
Admins

Verification

Company verification
Candidate verification
Document verification
Employment verification

Jobs

Job moderation
Job approval
Job suspension
Job reporting

Assessments

Aptitude tests
Industry tests
Question bank
Test attempts
Passing criteria
Assessment analytics

Recruitment

Applications
Interviews
Placements
Hiring pipeline

Finance

Company billing
Placement fees
Invoices
Payments
Pending payments
60-day tracking

Communication

Email routing
Communication logs
Abuse detection
Message moderation
17. Additional Features I Would Add

To make this platform significantly stronger, I'd add these modules:

⭐ Candidate Verification Levels

Instead of simply Verified/Unverified:

Basic Verified
Identity Verified
Professional Verified
Fully Verified

This gives companies more information without exposing private documents.

⭐ Company Trust Profile

Show:

Company verified status
Industry
Company size
Location
Hiring history
Number of jobs posted
Successful hires
Average response time

But avoid allowing unverifiable public ratings that could unfairly damage companies.

⭐ Candidate Availability

Candidates can select:

🟢 Available immediately
🟡 Available within 30 days
🟠 Notice period >30 days
🔴 Not currently looking

This becomes extremely useful for recruiters.

⭐ Notice Period Matching

Automatically match:

Company requires joining within 30 days

with candidates:

Available in 15 days

⭐ CTC Matching

Show:

Current CTC: ₹6 LPA
Expected: ₹8 LPA
Company Range: ₹7–9 LPA

This helps eliminate unsuitable applications.

⭐ Interview AI Assistant

After interviews, recruiters can enter structured feedback and the system can summarize:

Technical skills
Communication
Role fit
Experience
Salary expectations
Joining availability

Keep the final hiring decision with the employer.

⭐ Recruiter Workspace

Allow companies to invite multiple HR/recruitment employees.

For example:

XYZ Pvt Ltd

→ HR Admin
→ Recruiter 1
→ Recruiter 2
→ Hiring Manager
→ Interviewer

with role-based permissions.

⭐ Candidate Consent Management

Candidates should control:

Who can see their profile
Whether recruiters can contact them
Whether their profile appears in searches
Whether their profile can be recommended
Which documents can be shared

This is especially important because you're handling identity, education, employment and salary information.

18. Revenue Model

Your core model can be:

Companies

No payment from candidates

Companies can pay through:

Option A — Success Fee

Pay after the candidate remains employed for the agreed period.

Option B — Subscription

Monthly/annual recruiter plans.

Option C — Hybrid

Low subscription + reduced placement fee.

You could also charge for optional services:

Priority job posting
Featured employer
Bulk hiring
Professional candidate screening
Background verification
Video interviews
Recruitment assistance
Resume database access
Dedicated recruiter
19. Overall Platform Flow
Job Seeker

Register

↓

Complete Profile

↓

Verify Identity + Education + Experience

↓

Take Level 1 Assessment

↓

Take Industry/Role Assessment

↓

Build Resume

↓

Browse Jobs

↓

Apply

↓

Company Shortlists

↓

Interview

↓

Offer

↓

Join

Company

Register

↓

Submit Company Verification

↓

Verify Payment/Billing Details

↓

Company becomes Verified

↓

Create Job

↓

Receive Matched Candidates

↓

Shortlist

↓

Interview

↓

Select Candidate

↓

Candidate Joins

↓

60-Day Tracking

↓

Recruitment Fee
