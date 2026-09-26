import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";
import { PLANS, SERVICES } from "@/lib/plans";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Plans for companies</h1>
        <p className="mt-2 text-ink-2">
          Candidates never pay. Companies choose a success fee, a subscription or a hybrid. Placement fees are generated only after the candidate completes 60 days with you — if they leave earlier, you pay nothing.
        </p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.code} className={`flex flex-col p-6 ${p.code === "success" ? "ring-2 ring-accent" : ""}`}>
            {p.code === "success" ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Most popular</p> : null}
            <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
            <p className="mt-1 text-sm text-ink-2">{p.tagline}</p>
            <p className="mt-5 text-3xl font-semibold text-ink">
              {formatINR(p.monthlyPrice)}
              <span className="text-base font-normal text-ink-2">/month</span>
            </p>
            <p className="text-sm text-ink-2">{p.placementFeePercent ? `+ ${p.placementFeePercent}% of first-year CTC, due after ${p.guaranteeDays} days` : "No placement fees"}</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
                  <span className="text-ink">{f}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/register?role=company" className="mt-6" variant={p.code === "success" ? "primary" : "secondary"}>
              Start with {p.name}
            </ButtonLink>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-3">Prices exclude 18% GST. Example: a candidate joins on 1 September at ₹12 LPA on the Success Fee plan → the 60-day milestone is 31 October, when an invoice of {formatINR(Math.round(1_200_000 * 0.0833))} + GST is generated.</p>

      <h2 className="mt-16 text-2xl font-semibold text-ink">Optional services</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <Card key={s.code} className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-ink">{s.name}</h3>
              <p className="whitespace-nowrap text-sm font-medium text-ink">{formatINR(s.price)}</p>
            </div>
            <p className="text-xs text-ink-3">{s.unit}</p>
            <p className="mt-2 text-sm text-ink-2">{s.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
