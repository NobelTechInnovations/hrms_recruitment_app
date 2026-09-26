import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, jobs, serviceRequests } from "@/db/schema";
import { recordDepartureAction, requestReplacementAction } from "@/actions/company";
import { InvoiceStatusBadge, PlacementStatusBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatTile, Table, Td, Th } from "@/components/ui";
import { daysBetween } from "@/lib/billing";
import { formatDate, formatINR, formatLpa } from "@/lib/format";
import { getPlan, getService, PLANS, SERVICES } from "@/lib/plans";
import { requireCompany } from "@/server/auth";
import { companyPlacements } from "@/server/company-queries";
import { DepartureForm, PlanForm, ServiceForm } from "./billing-forms";

export const metadata: Metadata = { title: "Billing & placements" };

export default async function BillingPage() {
  const { company } = await requireCompany("billing.manage");
  const [placementRows, invoiceRows, requests, activeJobs] = await Promise.all([
    companyPlacements(company.id),
    db.select().from(invoices).where(eq(invoices.companyId, company.id)).orderBy(desc(invoices.issuedAt)),
    db.select().from(serviceRequests).where(eq(serviceRequests.companyId, company.id)).orderBy(desc(serviceRequests.createdAt)),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(and(eq(jobs.companyId, company.id), eq(jobs.status, "active"))),
  ]);
  const plan = getPlan(company.planCode);
  const outstanding = invoiceRows.filter((i) => i.status === "issued" || i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const paid = invoiceRows.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageHeader title="Billing & placements" description="Deferred placement fees: an invoice is generated only after your hire completes the 60-day period." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Current plan" value={plan.name} hint={plan.placementFeePercent ? `${plan.placementFeePercent}% placement fee` : "No placement fee"} />
        <StatTile label="In 60-day period" value={placementRows.filter((p) => p.placement.status === "in_guarantee").length} />
        <StatTile label="Outstanding" value={formatINR(outstanding)} hint="incl. GST" />
        <StatTile label="Paid to date" value={formatINR(paid)} />
      </div>

      <Card>
        <CardHeader title="Placement tracking" description="Selected date, joining date, 60-day milestone, invoice and replacement eligibility." />
        {placementRows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Selected</Th>
                <Th>Joined</Th>
                <Th>60-day milestone</Th>
                <Th>Fee</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {placementRows.map(({ placement: p, candidate, job }) => {
                const left = p.milestoneDate ? daysBetween(now, p.milestoneDate) : null;
                return (
                  <tr key={p.id}>
                    <Td>
                      <p className="font-medium">{candidate.fullName}</p>
                      <p className="text-xs text-ink-3">
                        {job.title} · {formatLpa(p.offeredCtc)} · {getPlan(p.planCode).name}
                      </p>
                    </Td>
                    <Td>{formatDate(p.selectedAt)}</Td>
                    <Td>{p.joiningDate ? formatDate(p.joiningDate) : <span className="text-ink-3">Expected {formatDate(p.expectedJoiningDate)}</span>}</Td>
                    <Td>
                      {formatDate(p.milestoneDate)}
                      {p.status === "in_guarantee" && left != null ? <p className="text-xs text-ink-3">{left > 0 ? `${left} days to go` : "Due today"}</p> : null}
                    </Td>
                    <Td>{p.feeAmount != null ? formatINR(p.feeAmount) : p.status === "in_guarantee" ? <span className="text-ink-3">Due after milestone</span> : "—"}</Td>
                    <Td>
                      <PlacementStatusBadge status={p.status} />
                      {p.leftAt ? <p className="mt-1 text-xs text-ink-3">Left {formatDate(p.leftAt)}</p> : null}
                      {p.replacementStatus !== "none" ? <Badge tone={p.replacementStatus === "eligible" ? "warn" : "info"} className="mt-1">Replacement: {p.replacementStatus}</Badge> : null}
                    </Td>
                    <Td className="min-w-48">
                      {p.replacementStatus === "eligible" ? <ActionButton action={requestReplacementAction.bind(null, p.id)} variant="primary">Request replacement</ActionButton> : null}
                      {!p.leftAt && ["pending_joining", "in_guarantee", "fee_due", "completed"].includes(p.status) ? <DepartureForm action={recordDepartureAction.bind(null, p.id)} /> : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <EmptyState title="No placements yet" description="When you mark a candidate as Selected, their placement is tracked here." />
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Invoices" />
        {invoiceRows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Description</Th>
                <Th>Amount</Th>
                <Th>GST</Th>
                <Th>Total</Th>
                <Th>Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((inv) => (
                <tr key={inv.id}>
                  <Td className="font-mono text-xs">{inv.number}</Td>
                  <Td>
                    {inv.description}
                    <p className="text-xs text-ink-3">Issued {formatDate(inv.issuedAt)}</p>
                  </Td>
                  <Td>{formatINR(inv.amount)}</Td>
                  <Td>{formatINR(inv.taxAmount)}</Td>
                  <Td className="font-medium">{formatINR(inv.total)}</Td>
                  <Td>{formatDate(inv.dueAt)}</Td>
                  <Td>
                    <InvoiceStatusBadge status={inv.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="text-sm text-ink-2">No invoices yet.</p>
          </CardBody>
        )}
        <CardBody className="border-t border-line text-xs text-ink-3">Pay by bank transfer or UPI quoting the invoice number; payments are reconciled by our finance team.</CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Plan" description="Choose success fee, subscription or hybrid." />
          <CardBody>
            <PlanForm plans={PLANS} current={company.planCode} cycle={company.billingCycle} />
            {company.subscriptionRenewsAt ? <p className="mt-3 text-xs text-ink-3">Subscription renews on {formatDate(company.subscriptionRenewsAt)}.</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Optional services" />
          <CardBody className="space-y-4">
            <ServiceForm services={SERVICES} jobs={activeJobs.map((j) => ({ value: j.id, label: j.title }))} />
            {requests.length ? (
              <ul className="divide-y divide-line border-t border-line pt-2 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {getService(r.serviceCode)?.name ?? r.serviceCode} {r.quantity > 1 ? `× ${r.quantity}` : ""} <span className="text-ink-3">· {formatDate(r.createdAt)}</span>
                    </span>
                    <Badge tone={r.status === "fulfilled" ? "good" : r.status === "cancelled" ? "neutral" : "info"}>{r.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
