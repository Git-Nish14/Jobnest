"use client";

import { useState } from "react";
import { TrendingUp, Save, Loader2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { computeVestingSchedule, type VestingYear } from "@/lib/utils/salary-helpers";
import { formatSalary } from "@/services/salary";
import type { RSUEquityDetails, SalaryDetails } from "@/types";
import { toast } from "sonner";

interface RSUVestingFormProps {
  applicationId: string;
  existing: RSUEquityDetails | null;
  currency?: string;
  onSaved?: (details: RSUEquityDetails) => void;
}

const DEFAULT: RSUEquityDetails = {
  total_shares: 0,
  grant_date: new Date().toISOString().split("T")[0],
  cliff_months: 12,
  vest_months: 48,
  current_price: 0,
};

export function RSUVestingForm({ applicationId, existing, currency = "USD", onSaved }: RSUVestingFormProps) {
  const [details, setDetails] = useState<RSUEquityDetails>(existing ?? DEFAULT);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof RSUEquityDetails, value: number | string) =>
    setDetails((prev) => ({ ...prev, [key]: value }));

  const schedule: VestingYear[] =
    details.total_shares > 0 && details.current_price > 0
      ? computeVestingSchedule(details)
      : [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      // Scope the update to the authenticated user's own record via the join to job_applications.
      // RLS on salary_details enforces this at the DB level; the JS filter is defence-in-depth.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); return; }

      const { error } = await supabase
        .from("salary_details")
        .update({ equity_details: details } as Partial<SalaryDetails>)
        .eq("application_id", applicationId);

      if (error) throw error;
      toast.success("RSU details saved");
      onSaved?.(details);
    } catch {
      toast.error("Failed to save RSU details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Total Shares</Label>
          <Input
            type="number"
            min={0}
            value={details.total_shares || ""}
            onChange={(e) => set("total_shares", Number(e.target.value))}
            placeholder="e.g. 10000"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Current Stock Price ($)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={details.current_price || ""}
            onChange={(e) => set("current_price", Number(e.target.value))}
            placeholder="e.g. 150.00"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Grant Date</Label>
          <Input
            type="date"
            value={details.grant_date}
            onChange={(e) => set("grant_date", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cliff (months)</Label>
          <Input
            type="number"
            min={1}
            value={details.cliff_months}
            onChange={(e) => set("cliff_months", Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Vesting Period (months)</Label>
          <Input
            type="number"
            min={details.cliff_months}
            value={details.vest_months}
            onChange={(e) => set("vest_months", Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {schedule.length > 0 && (
        <div className="rounded-lg border bg-muted/30 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
            <TrendingUp className="h-3.5 w-3.5 text-[#99462a]" />
            <span className="text-xs font-semibold text-foreground">Vesting Schedule</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Year</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Shares</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.year} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">Year {row.year}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.sharesVested.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#99462a]">
                    {formatSalary(row.value, currency)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td className="px-3 py-2 font-semibold text-foreground">Total ({Math.round(details.vest_months / 12)}yr)</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {details.total_shares.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-[#99462a]">
                  {formatSalary(details.total_shares * details.current_price, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save RSU Details
      </Button>
    </div>
  );
}
