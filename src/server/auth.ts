import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { candidates, companies, companyMembers, sessions, users, type Candidate, type Company, type CompanyMember, type User } from "@/db/schema";
import { can, type CompanyPermission } from "@/lib/permissions";
import { UserError } from "@/lib/errors";

const SESSION_COOKIE = "hrms_session";
const SESSION_DAYS = 30;

export { hashPassword, verifyPassword } from "./password";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_COOKIES,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.status !== "active") return null;
  return row.user;
});

export function homePathFor(user: Pick<User, "role">): string {
  if (user.role === "admin") return "/admin";
  if (user.role === "company") return "/company";
  return "/candidate";
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const getCandidateForUser = cache(async (userId: string): Promise<Candidate | null> => {
  const [row] = await db.select().from(candidates).where(eq(candidates.userId, userId)).limit(1);
  return row ?? null;
});

export async function requireCandidate(): Promise<{ user: User; candidate: Candidate }> {
  const user = await requireUser();
  if (user.role !== "candidate") redirect(homePathFor(user));
  const candidate = await getCandidateForUser(user.id);
  if (!candidate) redirect("/login");
  return { user, candidate };
}

export const getMembershipForUser = cache(async (userId: string): Promise<{ member: CompanyMember; company: Company } | null> => {
  const [row] = await db
    .select({ member: companyMembers, company: companies })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(eq(companyMembers.userId, userId))
    .limit(1);
  return row ?? null;
});

export type CompanyContext = { user: User; member: CompanyMember; company: Company };

export async function requireCompany(permission?: CompanyPermission): Promise<CompanyContext> {
  const user = await requireUser();
  if (user.role !== "company") redirect(homePathFor(user));
  const membership = await getMembershipForUser(user.id);
  if (!membership) redirect("/company/onboarding");
  if (permission && !can(membership.member.role, permission)) redirect("/company?denied=1");
  return { user, ...membership };
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect(homePathFor(user));
  return user;
}

export class AuthError extends UserError {}

/** For server actions: throw instead of redirecting when a permission is missing. */
export function assertCan(ctx: CompanyContext, permission: CompanyPermission) {
  if (!can(ctx.member.role, permission)) throw new AuthError("You don't have permission to do that.");
}
