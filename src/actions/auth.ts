"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates, companyInvites, companyMembers, users } from "@/db/schema";
import { email, fail, parseForm, requiredText, type ActionState } from "@/lib/forms";
import { makeMaskedAddress } from "@/lib/masked-address";
import { createSession, destroySession, getCurrentUser, hashPassword, homePathFor, verifyPassword } from "@/server/auth";
import { notify } from "@/server/notify";

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

async function uniqueCandidateAddress(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const addr = makeMaskedAddress("candidate");
    const [clash] = await db.select({ id: candidates.id }).from(candidates).where(eq(candidates.maskedEmail, addr)).limit(1);
    if (!clash) return addr;
  }
  throw new Error("Could not allocate a relay address");
}

function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(z.object({ email: email(), password: z.string().min(1, "Enter your password") }), fd);
  if (parsed.error) return parsed.error;
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return fail("Incorrect email or password.");
  if (user.status !== "active") return fail("This account has been suspended. Contact support for help.");
  await createSession(user.id);
  redirect(safeNext(fd.get("next") as string) ?? homePathFor(user));
}

const registerSchema = z.object({
  role: z.enum(["candidate", "company"]),
  name: requiredText("Full name", 120),
  email: email(),
  password: passwordSchema,
  inviteToken: z.string().optional(),
  consent: z.literal("on", { error: "Please accept the terms and privacy policy" }),
});

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(registerSchema, fd);
  if (parsed.error) return parsed.error;
  const { role, name, email: mail, password, inviteToken } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, mail)).limit(1);
  if (existing) return fail("An account with this email already exists.", { email: "Already registered — sign in instead" });

  let invite: typeof companyInvites.$inferSelect | undefined;
  if (inviteToken) {
    [invite] = await db
      .select()
      .from(companyInvites)
      .where(and(eq(companyInvites.token, inviteToken), eq(companyInvites.status, "pending")))
      .limit(1);
    if (!invite) return fail("This invitation is no longer valid.");
    if (invite.email.toLowerCase() !== mail) return fail("Use the email address the invitation was sent to.", { email: `Invitation was sent to ${invite.email}` });
  }

  const [user] = await db
    .insert(users)
    .values({ email: mail, name, role: invite ? "company" : role, passwordHash: await hashPassword(password) })
    .returning();

  if (invite) {
    await db.insert(companyMembers).values({ companyId: invite.companyId, userId: user!.id, role: invite.role });
    await db.update(companyInvites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(companyInvites.id, invite.id));
    await createSession(user!.id);
    redirect("/company");
  }

  if (role === "candidate") {
    await db.insert(candidates).values({ userId: user!.id, fullName: name, maskedEmail: await uniqueCandidateAddress() });
    await notify(user!.id, {
      type: "welcome",
      title: "Welcome to HRMS Talent",
      body: "Complete your profile, verify your documents and take the Level 1 assessment to get noticed by verified companies.",
      link: "/candidate/profile",
    });
    await createSession(user!.id);
    redirect("/candidate/profile?welcome=1");
  }
  await createSession(user!.id);
  redirect("/company/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function acceptInviteAsCurrentUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const token = String(fd.get("token") ?? "");
  const [invite] = await db
    .select()
    .from(companyInvites)
    .where(and(eq(companyInvites.token, token), eq(companyInvites.status, "pending")))
    .limit(1);
  if (!invite) return fail("This invitation is no longer valid.");
  if (invite.email.toLowerCase() !== user.email) return fail(`This invitation was sent to ${invite.email}.`);
  if (user.role !== "company") return fail("Candidate accounts can't join a company workspace. Register a new account with this email instead.");
  const [membership] = await db.select().from(companyMembers).where(eq(companyMembers.userId, user.id)).limit(1);
  if (membership) return fail("You already belong to a company workspace.");
  await db.insert(companyMembers).values({ companyId: invite.companyId, userId: user.id, role: invite.role });
  await db.update(companyInvites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(companyInvites.id, invite.id));
  redirect("/company");
}
