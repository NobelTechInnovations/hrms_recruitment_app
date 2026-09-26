// Multi-channel notifications (README §15): in-app always; email, SMS and WhatsApp per user preference.
// Providers are pluggable via environment variables; without credentials, deliveries are logged
// (visible to admins under Admin → Notifications) so every flow works in development.

import { and, eq, inArray } from "drizzle-orm";
import type { Transporter } from "nodemailer";
import { db } from "@/db";
import { companyMembers, notificationDeliveries, notifications, users } from "@/db/schema";
import { can, type CompanyPermission } from "@/lib/permissions";

export type NotificationPayload = { type: string; title: string; body?: string; link?: string };
type DeliveryResult = { status: "sent" | "logged" | "failed" | "skipped"; provider: string; error?: string };

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

// ─── Email ─────────────────────────────────────────────────────────────────

let transporter: Transporter | null = null;
async function getTransporter(): Promise<Transporter | null> {
  if (!process.env.SMTP_URL) return null;
  if (!transporter) {
    const nodemailer = await import("nodemailer");
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  }
  return transporter;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; from?: string; replyTo?: string }): Promise<DeliveryResult> {
  const from = msg.from ?? process.env.MAIL_FROM ?? `HRMS Talent <no-reply@${process.env.RELAY_DOMAIN ?? "panel.com"}>`;
  try {
    const t = await getTransporter();
    if (!t) {
      if (process.env.NODE_ENV !== "test") console.info(`[email:log] to=${msg.to} subject="${msg.subject}"`);
      return { status: "logged", provider: "log" };
    }
    await t.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, replyTo: msg.replyTo });
    return { status: "sent", provider: "smtp" };
  } catch (err) {
    return { status: "failed", provider: "smtp", error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── SMS / WhatsApp (Twilio) ───────────────────────────────────────────────

async function sendTwilio(channel: "sms" | "whatsapp", to: string, body: string): Promise<DeliveryResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = channel === "sms" ? process.env.TWILIO_SMS_FROM : process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "test") console.info(`[${channel}:log] to=${to} body="${body.slice(0, 80)}"`);
    return { status: "logged", provider: "log" };
  }
  const prefix = channel === "whatsapp" ? "whatsapp:" : "";
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: `${prefix}${to}`, From: `${prefix}${from}`, Body: body }),
    });
    if (!res.ok) return { status: "failed", provider: "twilio", error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { status: "sent", provider: "twilio" };
  } catch (err) {
    return { status: "failed", provider: "twilio", error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

export async function notify(userId: string, payload: NotificationPayload, opts: { inAppOnly?: boolean } = {}): Promise<void> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;
    const [row] = await db
      .insert(notifications)
      .values({ userId, type: payload.type, title: payload.title, body: payload.body ?? null, link: payload.link ?? null })
      .returning({ id: notifications.id });

    const text = [payload.body ?? payload.title, payload.link ? `\nOpen: ${appUrl(payload.link)}` : ""].join("");
    const deliveries: { channel: "email" | "sms" | "whatsapp"; destination: string | null; result: DeliveryResult }[] = [];

    if (opts.inAppOnly) return;
    if (user.notifyEmail) {
      deliveries.push({ channel: "email", destination: user.email, result: await sendEmail({ to: user.email, subject: payload.title, text }) });
    }
    for (const channel of ["sms", "whatsapp"] as const) {
      const enabled = channel === "sms" ? user.notifySms : user.notifyWhatsapp;
      if (!enabled) continue;
      if (!user.phone) {
        deliveries.push({ channel, destination: null, result: { status: "skipped", provider: "none", error: "No phone number on file" } });
        continue;
      }
      deliveries.push({ channel, destination: user.phone, result: await sendTwilio(channel, user.phone, `${payload.title}${payload.body ? ` — ${payload.body}` : ""}`) });
    }
    if (deliveries.length) {
      await db.insert(notificationDeliveries).values(
        deliveries.map((d) => ({
          notificationId: row!.id,
          userId,
          channel: d.channel,
          destination: d.destination,
          status: d.result.status,
          provider: d.result.provider,
          error: d.result.error ?? null,
        })),
      );
    }
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

export async function notifyMany(userIds: string[], payload: NotificationPayload, opts: { inAppOnly?: boolean } = {}): Promise<void> {
  for (const id of new Set(userIds)) await notify(id, payload, opts);
}

/** Notify every member of a company who holds the given permission. */
export async function notifyCompany(
  companyId: string,
  payload: NotificationPayload,
  permission: CompanyPermission = "pipeline.view",
  opts: { inAppOnly?: boolean } = {},
): Promise<void> {
  const members = await db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId));
  await notifyMany(
    members.filter((m) => can(m.role, permission)).map((m) => m.userId),
    payload,
    opts,
  );
}

export async function notifyAdmins(payload: NotificationPayload): Promise<void> {
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active")));
  await notifyMany(
    admins.map((a) => a.id),
    payload,
  );
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const where = ids?.length ? and(eq(notifications.userId, userId), inArray(notifications.id, ids)) : eq(notifications.userId, userId);
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}
