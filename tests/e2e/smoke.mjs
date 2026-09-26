// End-to-end smoke test of the main user journeys against a running, freshly seeded app.
//   npm run db:reset && npm run build && npm start   (in one terminal)
//   npm run test:e2e                                 (in another)
// Env: BASE_URL (default http://localhost:3000), PLAYWRIGHT_CHROMIUM_PATH (optional),
//      RELAY_WEBHOOK_SECRET (optional — enables the inbound email relay check).

import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Password@123";
const stamp = Date.now().toString(36);
const results = [];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });

async function session() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
}

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ step: name, ok: true, ms: Date.now() - started });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ step: name, ok: false, error: err.message });
    console.log(`✗ ${name}\n  ${err.message.split("\n")[0]}`);
  }
}

const expectText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
};

// ─── Candidate journey ─────────────────────────────────────────────────────
const candidateEmail = `e2e.candidate.${stamp}@example.com`;
const cand = await session();
let applicationUrl = "";

await step("Candidate registers", async () => {
  await cand.page.goto(`${BASE}/register`);
  await cand.page.fill("#name", "Test Candidate");
  await cand.page.fill("#email", candidateEmail);
  await cand.page.fill("#password", PASSWORD);
  await cand.page.check("input[name=consent]");
  await Promise.all([cand.page.waitForURL(/\/candidate\/profile/), cand.page.click("button[type=submit]")]);
});

await step("Candidate completes profile", async () => {
  const p = cand.page;
  await p.fill("#headline", "Frontend Developer");
  await p.fill("#currentLocation", "Pune");
  await p.fill("#preferredLocations", "Pune, Bengaluru");
  await p.selectOption("#industry", "it");
  await p.fill("#experienceYears", "3");
  await p.fill("#currentCtc", "7");
  await p.fill("#expectedCtc", "10");
  await p.fill("#noticePeriodDays", "15");
  await p.fill("#skills", "React, TypeScript, CSS, Next.js");
  await p.fill("#languages", "English, Hindi");
  await p.getByRole("button", { name: "Save profile" }).click();
  await expectText(p, "Profile saved.");
});

await step("Candidate adds education", async () => {
  const p = cand.page;
  await p.selectOption("#level", "graduate");
  await p.fill("#degree", "B.E. Computer Engineering");
  await p.fill("#institution", "Pune University");
  await p.getByRole("button", { name: "Add education" }).click();
  await expectText(p, "Education added.");
});

await step("Candidate applies to a job", async () => {
  const p = cand.page;
  await p.goto(`${BASE}/jobs?q=Frontend`);
  await p.getByRole("link", { name: "Frontend Developer (React)" }).first().click();
  await p.waitForURL(/\/jobs\//);
  await expectText(p, "Why this matches you");
  await Promise.all([p.waitForURL(/\/candidate\/applications\/.+applied=1/), p.getByRole("button", { name: "Apply now" }).click()]);
  applicationUrl = p.url();
  await expectText(p, "Application submitted");
});

await step("Candidate takes the Level 1 assessment", async () => {
  const p = cand.page;
  await p.goto(`${BASE}/candidate/assessments`);
  await Promise.all([p.waitForURL(/\/candidate\/assessments\/.+/), p.getByRole("button", { name: "Start assessment" }).first().click()]);
  const groups = await p.locator("fieldset").count();
  assert.ok(groups >= 5, `expected questions, got ${groups}`);
  for (let i = 0; i < groups; i++) await p.locator("fieldset").nth(i).locator("input[type=radio]").first().check();
  await p.getByRole("button", { name: "Submit answers" }).click();
  await expectText(p, "Score by topic");
});

await step("Candidate builds a resume and downloads the PDF", async () => {
  const p = cand.page;
  await p.goto(`${BASE}/candidate/resumes`);
  await p.fill("#title", "IT Resume");
  await Promise.all([p.waitForURL(/\/candidate\/resumes\/.+/), p.getByRole("button", { name: "Create resume" }).click()]);
  await expectText(p, "Resume completeness");
  const pdfHref = await p.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  const res = await p.request.get(`${BASE}${pdfHref}`);
  assert.equal(res.status(), 200);
  assert.equal(res.headers()["content-type"], "application/pdf");
  assert.ok((await res.body()).subarray(0, 4).toString() === "%PDF");
});

// ─── Company journey ───────────────────────────────────────────────────────
const comp = await session();

await step("Company shortlists, schedules an interview and messages the candidate", async () => {
  const p = comp.page;
  await login(p, "hr@xyzsoft.com");
  await p.goto(`${BASE}/company/applications`);
  await p.getByRole("link", { name: "Test Candidate" }).first().click();
  await p.waitForURL(/\/company\/applications\//);
  await p.selectOption("#to", "shortlisted");
  await p.getByRole("button", { name: "Update stage" }).click();
  await expectText(p, "Stage updated and candidate notified.");
  if (!(await p.locator("#iv-title").isVisible())) await p.getByText("Schedule an interview").click();
  await p.fill("#iv-title", "Technical interview — React");
  await p.getByRole("button", { name: "Schedule & notify candidate" }).click();
  await expectText(p, "Interview scheduled");
  await Promise.all([p.waitForURL(/\/company\/messages\//), p.getByRole("button", { name: "Message" }).click()]);
  await p.fill("#body", "Hi! Great profile. Call me at 98765 43210 or hr.personal@gmail.com");
  await p.getByRole("button", { name: "Send" }).click();
  await expectText(p, "contact details were removed");
});

await step("Candidate sees the shortlist notification, interview and redacted message", async () => {
  const p = cand.page;
  await p.goto(`${BASE}/notifications`);
  await expectText(p, "Your application has been shortlisted.");
  await expectText(p, "Your interview has been scheduled");
  await p.goto(applicationUrl.split("?")[0]);
  await expectText(p, "Technical interview — React");
  const ics = await p.getByRole("link", { name: ".ics" }).first().getAttribute("href");
  const res = await p.request.get(`${BASE}${ics}`);
  assert.equal(res.status(), 200);
  assert.ok((await res.text()).includes("BEGIN:VCALENDAR"));
  await p.goto(`${BASE}/candidate/messages`);
  await p.getByRole("link", { name: /XYZ Softech/ }).first().click();
  await expectText(p, "[contact details removed]");
  await p.fill("#body", "Thanks, looking forward to it!");
  await p.getByRole("button", { name: "Send" }).click();
  await expectText(p, "Thanks, looking forward to it!");
});

await step("Company cannot open documents the candidate didn't share", async () => {
  const docs = await comp.page.request.get(`${BASE}/api/files/does-not-exist`);
  assert.equal(docs.status(), 404);
});

// ─── New company onboarding ────────────────────────────────────────────────
const newco = await session();
let newJobUrl = "";
await step("New company registers, onboards and posts a job (held for approval)", async () => {
  const p = newco.page;
  await p.goto(`${BASE}/register?role=company`);
  await p.fill("#name", "Riya Kapoor");
  await p.fill("#email", `e2e.company.${stamp}@acme.example.com`);
  await p.fill("#password", PASSWORD);
  await p.check("input[name=consent]");
  await Promise.all([p.waitForURL(/\/company\/onboarding/), p.click("button[type=submit]")]);
  await p.fill("#name", `Acme Analytics ${stamp}`);
  await p.selectOption("#industry", "it");
  await p.selectOption("#size", "11-50");
  await p.fill("#city", "Chennai");
  await Promise.all([p.waitForURL(/\/company\/profile/), p.getByRole("button", { name: "Create company workspace" }).click()]);
  await expectText(p, "UNVERIFIED COMPANY");
  await p.goto(`${BASE}/company/jobs/new`);
  await p.fill("#title", `Data Analyst ${stamp}`);
  await p.fill("#location", "Chennai");
  await p.fill("#minExperience", "1");
  await p.fill("#requiredSkills", "SQL, Excel, Power BI");
  await p.fill("#description", "Analyse product data and build dashboards for business teams.");
  await Promise.all([p.waitForURL(/\/company\/jobs\/.+notice=/), p.getByRole("button", { name: "Publish job" }).click()]);
  newJobUrl = p.url();
  await expectText(p, "Submitted for approval");
});

// ─── Admin journey ─────────────────────────────────────────────────────────
const admin = await session();
await step("Admin approves the pending job", async () => {
  const p = admin.page;
  await login(p, "admin@panel.com");
  await p.goto(`${BASE}/admin/jobs`);
  const row = p.locator("tr", { hasText: `Data Analyst ${stamp}` });
  await row.getByRole("button", { name: "Approve" }).click();
  await p.locator("tr", { hasText: `Data Analyst ${stamp}` }).waitFor({ state: "detached", timeout: 15000 });
  await newco.page.goto(newJobUrl.split("?")[0]);
  await expectText(newco.page, "Active");
});

await step("Admin verifies BrightRetail", async () => {
  const p = admin.page;
  await p.goto(`${BASE}/admin/verification`);
  await p.locator("tr", { hasText: "BrightRetail" }).getByRole("link", { name: "Review" }).click();
  await p.getByRole("button", { name: "Mark as VERIFIED" }).click();
  await expectText(p, "VERIFIED COMPANY ✓");
});

await step("Admin approves a candidate document", async () => {
  const p = admin.page;
  await p.goto(`${BASE}/admin/verification?tab=documents`);
  const before = await p.getByRole("button", { name: "Approve" }).count();
  await p.getByRole("button", { name: "Approve" }).first().click();
  await p.waitForFunction((n) => document.querySelectorAll("button").length && [...document.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Approve").length < n, before, { timeout: 15000 });
});

await step("Admin records a payment on the 60-day placement invoice", async () => {
  const p = admin.page;
  await p.goto(`${BASE}/admin/finance?tab=pending`);
  const row = p.locator("tr", { hasText: "Placement fee" }).first();
  await row.getByText("Record payment").click();
  await row.getByRole("button", { name: "Save payment" }).click();
  await p.goto(`${BASE}/admin/finance`);
  await expectText(p, "Paid");
});

await step("Admin moderates a flagged message and runs scheduled jobs", async () => {
  const p = admin.page;
  await p.goto(`${BASE}/admin/communication`);
  await p.getByRole("button", { name: "Dismiss" }).first().click();
  await p.goto(`${BASE}/admin`);
  await p.getByRole("button", { name: "Run scheduled jobs now" }).click();
  await expectText(p, "Done:");
});

if (process.env.RELAY_WEBHOOK_SECRET) {
  await step("Inbound email relay routes a reply to the company", async () => {
    const res = await admin.page.request.post(`${BASE}/api/mail/inbound`, {
      headers: { "x-relay-secret": process.env.RELAY_WEBHOOK_SECRET },
      data: { from: `Test Candidate <${candidateEmail}>`, to: "hr_53543@panel.com", subject: "Re: Frontend Developer (React)", text: "Replying from my inbox.\n\nOn Tue, XYZ wrote:\n> quoted" },
    });
    assert.equal(res.status(), 200, await res.text());
    const denied = await admin.page.request.post(`${BASE}/api/mail/inbound`, { headers: { "x-relay-secret": "wrong" }, data: {} });
    assert.equal(denied.status(), 401);
  });
}

for (const s of [cand, comp, newco, admin]) {
  if (s.errors.length) results.push({ step: "browser errors", ok: false, error: s.errors.join(" | ") });
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
if (failed.length) {
  console.log(failed);
  process.exit(1);
}
