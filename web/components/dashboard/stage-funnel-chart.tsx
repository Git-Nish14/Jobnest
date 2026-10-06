import type { StageFunnel } from "@/types";
import Link from "next/link";

export function StageFunnelChart({ data }: { data: StageFunnel[] }) {
  return <section className="db-content-card" aria-labelledby="stage-history-title">
    <h2 id="stage-history-title" className="db-headline text-xl">Stages reached</h2>
    <p className="text-xs text-muted-foreground mt-2 mb-4">Observed stages remain counted after a role closes. Missing or skipped stages are not inferred.</p>
    <table className="w-full text-sm"><caption className="sr-only">Distinct applications with evidence of each stage</caption><thead><tr><th scope="col" className="text-left py-2">Stage</th><th scope="col" className="text-right">Applications</th></tr></thead><tbody>{data.map((row) => <tr key={row.stage} className="border-t border-border"><th scope="row" className="text-left font-normal py-3">{row.stage}</th><td className="text-right font-semibold">{row.count}</td></tr>)}</tbody></table>
    <LinkToRoles />
  </section>;
}
function LinkToRoles() { return <Link href="/applications" className="db-link-primary inline-block text-sm mt-3">Inspect your application history</Link>; }
