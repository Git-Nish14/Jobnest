"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui";

type Skill = { id: string; name: string; category: string; proficiency: string };
type Count = { skill_id: string; endorsement_count: number; endorsed: boolean };
const PROF_STYLE: Record<string, string> = {
  Beginner: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Advanced: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Expert: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export function PublicSkillEndorsements({ username, skills }: { username: string; skills: Skill[] }) {
  const [counts, setCounts] = useState<Record<string, Count>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const endpoint = `/api/public/portfolios/${encodeURIComponent(username)}/endorsements`;
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load endorsements.");
      if (signal?.aborted) return;
      setCounts(Object.fromEntries((data.skills as Count[]).map(row => [row.skill_id, row])));
      setLoaded(true); setError("");
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : "Could not load endorsements."); }
  }, [endpoint]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function endorse(skill: Skill) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillId: skill.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your endorsement.");
      const row = (data.skills as Count[]).find(row => row.skill_id === skill.id);
      if (!row) throw new Error("Could not confirm your endorsement. Please refresh.");
      setCounts(previous => ({ ...previous, [skill.id]: row })); setNotice(`You endorsed ${skill.name}.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your endorsement."); }
    finally { pending.current = false; setBusy(false); }
  }
  const groups = skills.reduce<Record<string, Skill[]>>((result, skill) => { (result[skill.category] ??= []).push(skill); return result; }, {});
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">Recognize skills you know. No account required. Repeat endorsements from the same browser or network are limited.</p>
    {Object.entries(groups).map(([category, items]) => <div key={category}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{category}</h3>
      <div className="flex flex-wrap gap-2">{items.map(skill => {
        const count = counts[skill.id];
        return <div key={skill.id} className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-background pl-3 pr-1 py-1">
          <span className="text-sm font-medium break-words">{skill.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PROF_STYLE[skill.proficiency] ?? "bg-muted"}`}>{skill.proficiency}</span>
          <Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11" disabled={!loaded || !count || busy || count.endorsed}
            aria-label={`${count?.endorsed ? "Endorsed" : "Endorse"} ${skill.name}${count ? `, ${count.endorsement_count} endorsements` : ""}`}
            onClick={() => void endorse(skill)}>{count?.endorsed ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
            {count ? count.endorsement_count.toLocaleString() : "…"}</Button>
        </div>;
      })}</div>
    </div>)}
    <p role="status" className="text-sm text-muted-foreground">{notice}</p>
    {error && <div role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void load()}>Refresh endorsements</Button></div>}
  </div>;
}
