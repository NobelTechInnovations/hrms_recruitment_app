import { and, eq, inArray, like, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments, placements, serviceRequests } from "@/db/schema";
import { addDays, invoiceNumber, withTax } from "@/lib/billing";
import { INVOICE_DUE_DAYS } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { notifyCompany } from "./notify";
import { UserError } from "@/lib/errors";

async function nextInvoiceNumber(now: Date): Promise<string> {
  const year = now.getUTCFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(like(invoices.number, `INV-${year}-%`));
  return invoiceNumber(year, Number(row?.n ?? 0) + 1);
}

export async function createInvoice(input: {
  companyId: string;
  kind: "placement_fee" | "subscription" | "service";
  description: string;
  amount: number;
  placementId?: string;
  serviceRequestId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { amount, taxAmount, total } = withTax(input.amount);
  const [invoice] = await db
    .insert(invoices)
    .values({
      number: await nextInvoiceNumber(now),
      companyId: input.companyId,
      kind: input.kind,
      description: input.description,
      amount,
      taxAmount,
      total,
      placementId: input.placementId ?? null,
      serviceRequestId: input.serviceRequestId ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      issuedAt: now,
      dueAt: addDays(now, INVOICE_DUE_DAYS),
    })
    .returning();
  await notifyCompany(
    input.companyId,
    { type: "invoice", title: `Invoice ${invoice!.number} generated`, body: `${input.description} — ${formatINR(total)} due in ${INVOICE_DUE_DAYS} days.`, link: "/company/billing" },
    "billing.manage",
  );
  return invoice!;
}

export async function recordPayment(input: { invoiceId: string; amount: number; method: string; reference?: string | null; recordedByUserId?: string | null }) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
  if (!invoice) throw new UserError("Invoice not found");
  if (invoice.status === "paid" || invoice.status === "void") throw new UserError(`Invoice is already ${invoice.status}.`);
  await db.insert(payments).values({
    invoiceId: invoice.id,
    amount: input.amount,
    method: input.method,
    reference: input.reference ?? null,
    recordedByUserId: input.recordedByUserId ?? null,
  });
  const [sum] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.invoiceId, invoice.id));
  const paid = Number(sum?.paid ?? 0);
  if (paid >= invoice.total) {
    await db.update(invoices).set({ status: "paid", paidAt: new Date() }).where(eq(invoices.id, invoice.id));
    if (invoice.placementId) {
      await db.update(placements).set({ status: "completed", updatedAt: new Date() }).where(eq(placements.id, invoice.placementId));
    }
    await notifyCompany(invoice.companyId, { type: "payment", title: `Payment received for ${invoice.number}`, body: `Thank you — ${formatINR(invoice.total)} received.`, link: "/company/billing" }, "billing.manage");
  }
  return { paid, fullyPaid: paid >= invoice.total };
}

export async function markOverdueInvoices(now = new Date()): Promise<number> {
  const rows = await db
    .update(invoices)
    .set({ status: "overdue" })
    .where(and(eq(invoices.status, "issued"), lt(invoices.dueAt, now)))
    .returning({ id: invoices.id, companyId: invoices.companyId, number: invoices.number });
  for (const r of rows) {
    await notifyCompany(r.companyId, { type: "invoice_overdue", title: `Invoice ${r.number} is overdue`, link: "/company/billing" }, "billing.manage");
  }
  return rows.length;
}

export async function voidInvoice(invoiceId: string) {
  const [inv] = await db.update(invoices).set({ status: "void" }).where(and(eq(invoices.id, invoiceId), inArray(invoices.status, ["issued", "overdue"]))).returning();
  if (inv?.serviceRequestId) await db.update(serviceRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(serviceRequests.id, inv.serviceRequestId));
  return inv;
}
