"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui";
import { RSUVestingForm } from "./RSUVestingForm";
import type { RSUEquityDetails } from "@/types";

export function EquityVestingEditor({ applicationId, existing, currency = "USD" }: {
  applicationId: string; existing: RSUEquityDetails | null; currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(existing);
  const router = useRouter();
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="min-h-11">{saved ? "Edit equity vesting" : "Add equity vesting"}</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Equity vesting</DialogTitle><DialogDescription>Track your share grant and preview its estimated vesting value.</DialogDescription></DialogHeader>
      {open && <RSUVestingForm applicationId={applicationId} existing={saved} currency={currency} onSaved={details => { setSaved(details); setOpen(false); router.refresh(); }} />}
    </DialogContent>
  </Dialog>;
}
