"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Loader2, MessageSquare } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils/date";

interface ConsentDetails {
  clientName: string;
  redirectHost: string;
  expiresAt: string;
}

const CONSENT_URL = "/api/integrations/chatgpt/oauth/consent";

export function ChatGptAuthorize({ requestId, email }: { requestId: string; email: string }) {
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<"connect" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const decisionInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRequest() {
      try {
        const response = await fetch(`${CONSENT_URL}?request=${encodeURIComponent(requestId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || "This connection request is unavailable. Start again from ChatGPT.");
        if (controller.signal.aborted) return;
        setDetails(data);
        setExpired(Date.parse(data.expiresAt) <= Date.now());
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load the connection request. Start again from ChatGPT.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRequest();
    return () => controller.abort();
  }, [requestId]);

  useEffect(() => {
    if (!details || expired) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(details.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [details, expired]);

  async function submitConsent(approved: boolean) {
    if (!details || expired || error || decisionInFlight.current) return;
    decisionInFlight.current = true;
    setDecision(approved ? "connect" : "cancel");
    try {
      const response = await fetch(CONSENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approved }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || "Could not complete this connection request.");
      // Only follow a secure callback on the host disclosed in the consent prompt.
      const destination = new URL(data.redirectUrl);
      if (destination.protocol !== "https:" || destination.host !== details.redirectHost || destination.username || destination.password) {
        throw new Error("The connection returned an invalid destination.");
      }
      window.location.assign(destination.href);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not complete this connection request.";
      // Consent requests are single-use. Do not silently retry an uncertain response.
      setError(`${message} Return to ChatGPT and start the connection again.`);
      setDecision(null);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect to Jobnest</h1>
        <CardDescription>Review the plugin&apos;s access to your job tracker before connecting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="break-words text-sm text-muted-foreground">Signed in as <strong className="font-medium text-foreground">{email || "your Jobnest account"}</strong></p>

        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading connection request...
          </p>
        ) : details ? (
          <>
            <dl className="space-y-3 rounded-lg border p-4 text-sm">
              <div><dt className="text-muted-foreground">Requesting app</dt><dd className="break-words font-medium">{details.clientName}</dd></div>
              <div><dt className="text-muted-foreground">Return address</dt><dd className="break-all font-mono text-xs">{details.redirectHost}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">Check the requesting app and return address. Continue only if you started this connection in ChatGPT.</p>
            <div className="flex gap-3 rounded-lg bg-primary/5 p-4">
              <BriefcaseBusiness className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Save job applications</p>
                <p className="text-muted-foreground">Create job records in your Jobnest account using the job details you choose to send from ChatGPT.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This permission does not allow reading your job list, editing existing jobs, or accessing your documents.
              It does not submit applications to employers.
            </p>
            <p className="text-sm text-muted-foreground">
              Connecting replaces any previous ChatGPT connection. You can disconnect anytime in Jobnest Account Settings.
            </p>
            <p className="text-xs text-muted-foreground">Request expires {formatDateTime(details.expiresAt)}.</p>
          </>
        ) : null}

        {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {expired && !error && <p role="alert" className="rounded-lg border p-3 text-sm">This connection request has expired. Return to ChatGPT and start again.</p>}

        {details && !error && !expired && (
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={Boolean(decision)} onClick={() => void submitConsent(true)}>
              {decision === "connect" && <Loader2 className="animate-spin" aria-hidden="true" />}
              {decision === "connect" ? "Connecting..." : "Connect"}
            </Button>
            <Button type="button" variant="outline" disabled={Boolean(decision)} onClick={() => void submitConsent(false)}>
              {decision === "cancel" && <Loader2 className="animate-spin" aria-hidden="true" />}
              {decision === "cancel" ? "Returning..." : "Cancel"}
            </Button>
          </div>
        )}
        {(error || expired) && (
          <Button asChild variant="outline"><Link href="/profile#chatgpt">Return to account settings</Link></Button>
        )}
      </CardContent>
    </Card>
  );
}
