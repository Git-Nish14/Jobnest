"use client";
import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <section role="alert" className="db-content-card"><h1 className="db-headline text-2xl">Your dashboard could not be loaded</h1><p className="text-sm text-muted-foreground mt-2">Your saved applications are still yours. We could not verify the current summary or plan; please retry.</p><button type="button" onClick={reset} className="db-btn-page-primary mt-4">Try again</button><Link href="/applications" className="db-link-primary ml-4">Open applications</Link></section>;
}
