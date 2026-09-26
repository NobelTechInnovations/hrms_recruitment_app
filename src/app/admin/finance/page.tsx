import type { Metadata } from "next";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, companies, invoices, jobs, payments, placements, serviceRequests } from "@/db/schema";
import { recordPaymentAction, resolveReplacementAction, setServiceStatusAction, voidInvoiceAction } from "@/actions/admin";
import { InvoiceStatusBadge, PlacementStatusBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, StatTile, Table, Tabs, Td, Th } from "@/components/ui";
import { daysBetween } from "@/lib/billing";
import { formatDate, formatINR, formatLpa } from "@/lib/format";
import { getPlan, getService, PLANS } from "@/lib/plans";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Finance" };

export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "invoices" } = await searchParams;
  const [allInvoices, paid] = await Promise.all([
    db.select({ invoice: invoices, company: companies.name }).from(invoices).innerJoin(companies, eq(companies.id, invoices.companyId)).orderBy(desc(invoices.issuedAt)),
    db.select({ invoiceId: payments.invoiceId, total: sql<number>`sum(${payments.amount})` }).from(payments).groupBy(payments.invoiceId),
  ]);
  const paidMap = new Map(paid.map((p) => [p.invoiceId, Number(p.total)]));
  const outstanding = allInvoices.filter((i) => ["issued", "overdue"].includes(i.invoice.status));
  const sum = (xs: typeof allInvoices) => xs.reduce((s, i) => s + i.invoice.total - (paidMap.get(i.invoice.id) ?? 0), 0);
  const placementFees = allInvoices.filter((i) => i.invoice.kind === "placement_fee" && i.invoice.status === "paid").reduce((s, i) => s + i.invoice.total, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Finance" description="Company billing, placement fees, invoices, payments and 60-day tracking." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Outstanding" value={formatINR(sum(outstanding))} hint={`${outstanding.length} invoices`} />
        <StatTile label="Overdue" value={formatINR(sum(allInvoices.filter((i) => i.invoice.status === "overdue")))} />
        <StatTile label="Collected" value={formatINR(allInvoices.filter((i) => i.invoice.status === "paid").reduce((s, i) => s + i.invoice.total, 0))} />
        <StatTile label="Placement fees collected" value={formatINR(placementFees)} />
      </div>
      <Tabs
        items={[
          { href: "/admin/finance", label: "Invoices", active: tab === "invoices" },
          { href: "/admin/finance?tab=pending", label: "Pending payments", active: tab === "pending", count: outstanding.length },
          { href: "/admin/finance?tab=tracking", label: "60-day tracking", active: tab === "tracking" },
          { href: "/admin/finance?tab=replacements", label: "Replacements", active: tab === "replacements" },
          { href: "/admin/finance?tab=services", label: "Service requests", active: tab === "services" },
          { href: "/admin/finance?tab=plans", label: "Plans", active: tab === "plans" },
        ]}
      />
      {tab === "invoices" || tab === "pending" ? (
        <InvoiceTable rows={tab === "pending" ? outstanding : allInvoices} paidMap={paidMap} />
      ) : tab === "tracking" || tab === "replacements" ? (
        <PlacementTable replacementsOnly={tab === "replacements"} />
      ) : tab === "services" ? (
        <ServiceTable />
      ) : (
        <PlanTable />
      )}
    </div>
  );
}

function InvoiceTable({ rows, paidMap }: { rows: { invoice: typeof invoices.$inferSelect; company: string }[]; paidMap: Map<string, number> }) {
  if (!rows.length) return <EmptyState title="No invoices" />;
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Invoice</Th>
            <Th>Company</Th>
            <Th>Description</Th>
            <Th>Total</Th>
            <Th>Paid</Th>
            <Th>Due</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ invoice: i, company }) => (
            <tr key={i.id}>
              <Td className="font-mono text-xs">{i.number}</Td>
              <Td>{company}</Td>
              <Td className="max-w-xs">
                {i.description}
                <p className="text-xs capitalize text-ink-3">{i.kind.replace("_", " ")}</p>
              </Td>
              <Td className="font-medium">{formatINR(i.total)}</Td>
              <Td>{formatINR(paidMap.get(i.id) ?? 0)}</Td>
              <Td>{formatDate(i.dueAt)}</Td>
              <Td><InvoiceStatusBadge status={i.status} /></Td>
              <Td className="min-w-40">
                {["issued", "overdue"].includes(i.status) ? (
                  <div className="space-y-2">
                    <PaymentForm action={recordPaymentAction.bind(null, i.id)} amount={i.total - (paidMap.get(i.id) ?? 0)} />
                    <ActionButton action={voidInvoiceAction.bind(null, i.id)} variant="ghost" confirm={`Void ${i.number}?`}>Void</ActionButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

async function PlacementTable({ replacementsOnly }: { replacementsOnly: boolean }) {
  let rows = await db
    .select({ placement: placements, company: companies.name, candidate: candidates.fullName, job: jobs.title })
    .from(placements)
    .innerJoin(companies, eq(companies.id, placements.companyId))
    .innerJoin(candidates, eq(candidates.id, placements.candidateId))
    .innerJoin(jobs, eq(jobs.id, placements.jobId))
    .orderBy(placements.milestoneDate);
  rows = replacementsOnly ? rows.filter((r) => r.placement.replacementStatus !== "none") : rows.filter((r) => ["pending_joining", "in_guarantee", "fee_due"].includes(r.placement.status));
  if (!rows.length) return <EmptyState title={replacementsOnly ? "No replacement cases" : "No placements being tracked"} />;
  const now = new Date();
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Candidate</Th>
            <Th>Company</Th>
            <Th>Selected</Th>
            <Th>Joined</Th>
            <Th>60-day milestone</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ placement: p, company, candidate, job }) => (
            <tr key={p.id}>
              <Td>
                <p className="font-medium">{candidate}</p>
                <p className="text-xs text-ink-3">{job} · {formatLpa(p.offeredCtc)} · {getPlan(p.planCode).name}</p>
              </Td>
              <Td>{company}</Td>
              <Td>{formatDate(p.selectedAt)}</Td>
              <Td>{formatDate(p.joiningDate)}</Td>
              <Td>
                {formatDate(p.milestoneDate)}
                {p.status === "in_guarantee" && p.milestoneDate ? <p className="text-xs text-ink-3">{Math.max(0, daysBetween(now, p.milestoneDate))} days left</p> : null}
              </Td>
              <Td>
                <PlacementStatusBadge status={p.status} />
                {p.replacementStatus !== "none" ? <Badge tone="warn" className="ml-1">Replacement: {p.replacementStatus}</Badge> : null}
                {p.leftAt ? <p className="text-xs text-ink-3">Left {formatDate(p.leftAt)}{p.leftReason ? ` — ${p.leftReason}` : ""}</p> : null}
              </Td>
              <Td>
                {p.replacementStatus === "requested" || p.replacementStatus === "eligible" ? (
                  <div className="flex flex-wrap gap-1">
                    <ActionButton action={resolveReplacementAction.bind(null, p.id, "fulfilled")}>Replacement provided</ActionButton>
                    <ActionButton action={resolveReplacementAction.bind(null, p.id, "refunded")} variant="ghost" confirm="Mark the placement fee as refunded?">Refund</ActionButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

async function ServiceTable() {
  const rows = await db.select({ sr: serviceRequests, company: companies.name }).from(serviceRequests).innerJoin(companies, eq(companies.id, serviceRequests.companyId)).orderBy(desc(serviceRequests.createdAt));
  if (!rows.length) return <EmptyState title="No service requests" />;
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Service</Th>
            <Th>Company</Th>
            <Th>Requested</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sr, company }) => (
            <tr key={sr.id}>
              <Td>
                {getService(sr.serviceCode)?.name ?? sr.serviceCode} {sr.quantity > 1 ? `× ${sr.quantity}` : ""}
                {sr.notes ? <p className="text-xs text-ink-3">{sr.notes}</p> : null}
              </Td>
              <Td>{company}</Td>
              <Td>{formatDate(sr.createdAt)}</Td>
              <Td><Badge tone={sr.status === "fulfilled" ? "good" : sr.status === "cancelled" ? "neutral" : "info"}>{sr.status.replace("_", " ")}</Badge></Td>
              <Td>
                {sr.status === "requested" || sr.status === "in_progress" ? (
                  <div className="flex flex-wrap gap-1">
                    {sr.status === "requested" ? <ActionButton action={setServiceStatusAction.bind(null, sr.id, "in_progress")}>Start</ActionButton> : null}
                    <ActionButton action={setServiceStatusAction.bind(null, sr.id, "fulfilled")}>Fulfilled</ActionButton>
                    <ActionButton action={setServiceStatusAction.bind(null, sr.id, "cancelled")} variant="ghost" confirm="Cancel and void the invoice?">Cancel</ActionButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

async function PlanTable() {
  const counts = await db.select({ plan: companies.planCode, n: sql<number>`count(*)` }).from(companies).groupBy(companies.planCode);
  const fees = await db.select({ plan: placements.planCode, n: sql<number>`count(*)` }).from(placements).where(inArray(placements.status, ["fee_due", "completed"])).groupBy(placements.planCode);
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Plan</Th>
            <Th>Monthly</Th>
            <Th>Placement fee</Th>
            <Th>Guarantee / replacement</Th>
            <Th>Companies</Th>
            <Th>Fee-bearing placements</Th>
          </tr>
        </thead>
        <tbody>
          {PLANS.map((p) => (
            <tr key={p.code}>
              <Td className="font-medium">{p.name}</Td>
              <Td>{formatINR(p.monthlyPrice)}</Td>
              <Td>{p.placementFeePercent ? `${p.placementFeePercent}% of CTC` : "—"}</Td>
              <Td>{p.guaranteeDays} / {p.replacementDays || "—"} days</Td>
              <Td>{Number(counts.find((c) => c.plan === p.code)?.n ?? 0)}</Td>
              <Td>{Number(fees.find((c) => c.plan === p.code)?.n ?? 0)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
