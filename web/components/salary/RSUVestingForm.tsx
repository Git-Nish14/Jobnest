"use client";

import { useId, useRef, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { computeVestingSchedule } from "@/lib/utils/salary-helpers";
import { equitySchema } from "@/lib/validations/equity";
import type { RSUEquityDetails } from "@/types";
import { toast } from "sonner";

function formatSalary(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${amount.toLocaleString()} ${currency}`; }
}

export function RSUVestingForm({ applicationId, existing, currency = "USD", onSaved }: {
  applicationId: string; existing: RSUEquityDetails | null; currency?: string;
  onSaved?: (details: RSUEquityDetails) => void;
}) {
  const prefix = useId();
  const [details, setDetails] = useState<RSUEquityDetails>(existing ?? {
    total_shares: 0, current_price: 0, grant_date: new Date().toISOString().slice(0, 10), cliff_months: 12, vest_months: 48,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const validated = equitySchema.safeParse(details);
  const schedule = validated.success ? computeVestingSchedule(validated.data) : [];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!validated.success) { setError(validated.error.issues[0].message); return; }
    pending.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/equity`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ equity_details: validated.data }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save equity details.");
      toast.success("Equity vesting saved"); onSaved?.(data.equity_details);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save equity details."); }
    finally { pending.current = false; setSaving(false); }
  }
  const fields = [
    { key: "total_shares", label: "Total shares", min: 0.000001, max: 1_000_000_000, step: "any" },
    { key: "current_price", label: `Current share price (${currency})`, min: 0, max: 1_000_000, step: "any" },
    { key: "cliff_months", label: "Cliff (months)", min: 0, max: 120, step: "1" },
    { key: "vest_months", label: "Vesting period (months)", min: 1, max: 120, step: "1" },
  ] as const;
  return <form onSubmit={save} className="space-y-4">
    <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map(field => <div key={field.key} className="space-y-1.5">
        <Label htmlFor={`${prefix}-${field.key}`}>{field.label}</Label>
        <Input id={`${prefix}-${field.key}`} type="number" required min={field.min} max={field.max} step={field.step}
          value={Number.isNaN(details[field.key]) ? "" : details[field.key]} className="min-h-11" onChange={event => { setError(""); setDetails(previous => ({ ...previous, [field.key]: event.target.value === "" ? NaN : Number(event.target.value) })); }} />
      </div>)}
      <div className="space-y-1.5"><Label htmlFor={`${prefix}-date`}>Grant date</Label>
        <Input id={`${prefix}-date`} type="date" required value={details.grant_date} className="min-h-11"
          onChange={event => { setError(""); setDetails(previous => ({ ...previous, grant_date: event.target.value })); }} />
      </div>
    </fieldset>
    <p className="text-xs text-muted-foreground">Monthly vesting after the cliff. Values use today’s share price and may change. A zero-month cliff starts vesting in month one.</p>
    {schedule.length > 0 && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
      <caption className="text-left p-3 font-medium">First four years from grant date</caption>
      <thead><tr><th className="p-2 text-left" scope="col">Year</th><th className="p-2 text-right" scope="col">Shares</th><th className="p-2 text-right" scope="col">Estimated value</th></tr></thead>
      <tbody>{schedule.map(row => <tr key={row.year} className="border-t"><th scope="row" className="p-2 text-left">{row.year}</th>
        <td className="p-2 text-right tabular-nums">{row.sharesVested.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
        <td className="p-2 text-right tabular-nums">{formatSalary(row.value, currency)}</td></tr>)}</tbody>
    </table></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="min-h-11" disabled={saving}>{saving ? "Saving…" : "Save equity vesting"}</Button>
  </form>;
}
