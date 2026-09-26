"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkbox, fail, optionalText, parseForm, type ActionState } from "@/lib/forms";
import { attempt } from "@/server/action-utils";
import { hashPassword, requireUser, verifyPassword } from "@/server/auth";
import { markNotificationsRead } from "@/server/notify";

export async function markAllReadAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  return attempt(() => markNotificationsRead(user.id));
}

export async function updateNotificationPrefsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(z.object({ phone: optionalText(20) }), fd);
  if (parsed.error) return parsed.error;
  const phone = parsed.data.phone;
  if (phone && !/^\+?[0-9 ()-]{8,20}$/.test(phone)) return fail("Please fix the highlighted fields.", { phone: "Enter a valid phone number with country code" });
  const notifySms = checkbox(fd, "notifySms");
  const notifyWhatsapp = checkbox(fd, "notifyWhatsapp");
  if ((notifySms || notifyWhatsapp) && !phone) return fail("Add a phone number to receive SMS or WhatsApp notifications.", { phone: "Required for SMS / WhatsApp" });
  return attempt(async () => {
    await db.update(users).set({ phone, notifyEmail: checkbox(fd, "notifyEmail"), notifySms, notifyWhatsapp }).where(eq(users.id, user.id));
  }, "Notification preferences saved.");
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(
    z.object({
      current: z.string().min(1, "Enter your current password"),
      next: z.string().min(8, "Use at least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
    }),
    fd,
  );
  if (parsed.error) return parsed.error;
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return fail("Current password is incorrect.", { current: "Incorrect password" });
  return attempt(async () => {
    await db.update(users).set({ passwordHash: await hashPassword(parsed.data.next) }).where(eq(users.id, user.id));
  }, "Password updated.");
}
