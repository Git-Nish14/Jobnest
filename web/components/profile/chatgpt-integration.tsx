"use client";

import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, ChevronDown, Copy, ExternalLink, FileText, FolderOpen, HelpCircle, Link2, Loader2, MessageSquare, RefreshCw, Search, Settings2, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui";
import { CHATGPT_FOLDER_INSTRUCTION, getChatGptSetup } from "@/lib/chatgpt/setup";
import { formatDateTime } from "@/lib/utils/date";

interface ChatGptCredential {
  id: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

type CredentialResponse = {
  credential: ChatGptCredential | null;
  error?: string;
};

const CREDENTIALS_URL = "/api/integrations/chatgpt/credentials";

export function ChatGptIntegration() {
  const setup = getChatGptSetup(process.env.NEXT_PUBLIC_APP_URL || "");
  const [credential, setCredential] = useState<ChatGptCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const mutationInFlight = useRef(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const folderInstructionInput = useRef<HTMLTextAreaElement>(null);
  const setupGuide = useRef<HTMLElement>(null);

  async function loadCredential(signal?: AbortSignal) {
    try {
      const response = await fetch(CREDENTIALS_URL, { cache: "no-store", signal });
      const data: CredentialResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your ChatGPT connection.");
      if (signal?.aborted) return;
      setCredential(data.credential);
      setExpired(Boolean(data.credential?.expires_at && Date.parse(data.credential.expires_at) <= Date.now()));
      setLoaded(true);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setLoaded(false);
      setError(err instanceof Error ? err.message : "Could not load your ChatGPT connection.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadCredential(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const expiresAt = credential?.expires_at;
    if (!expiresAt || expired) return;
    const timer = window.setInterval(() => {
      if (Date.parse(expiresAt) <= Date.now()) setExpired(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [credential, expired]);

  async function disconnect() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError(null);
    setConfirmDisconnect(false);
    try {
      const response = await fetch(CREDENTIALS_URL, { method: "DELETE" });
      const data: CredentialResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disconnect ChatGPT.");
      setCredential(null);
      setLoaded(true);
      toast.success("ChatGPT disconnected. Your saved jobs are still here.");
    } catch (err) {
      setLoaded(false);
      const message = err instanceof Error ? err.message : "Could not disconnect ChatGPT.";
      setError(`${message} Refresh status to check the connection before trying again.`);
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(setup.mcpUrl);
      toast.success("Jobnest plugin URL copied.");
    } catch {
      urlInput.current?.focus();
      urlInput.current?.select();
      toast.error("Could not copy automatically. The URL is selected so you can copy it manually.");
    }
  }

  async function copyFolderInstruction() {
    try {
      await navigator.clipboard.writeText(CHATGPT_FOLDER_INSTRUCTION);
      toast.success("ChatGPT folder instruction copied.");
    } catch {
      folderInstructionInput.current?.focus();
      folderInstructionInput.current?.select();
      toast.error("Could not copy automatically. The instruction is selected so you can copy it manually.");
    }
  }

  function refresh() {
    setLoading(true);
    setConfirmDisconnect(false);
    void loadCredential();
  }

  function toggleSetupGuide() {
    const opening = !setupOpen;
    setSetupOpen(opening);
    if (!opening) return;
    window.requestAnimationFrame(() => {
      const guide = setupGuide.current;
      if (!guide || guide.hidden) return;
      guide.focus({ preventScroll: true });
      guide.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  const connected = loaded && Boolean(credential) && !expired;
  const connectionLabel = loading
    ? "Checking connection"
    : connected
      ? "Connected"
      : loaded && credential
        ? "Connection expired"
        : loaded
          ? "Not connected"
          : "Status unavailable";

  return (
    <Card id="chatgpt" className="scroll-mt-8 overflow-hidden border-primary/15">
      <CardHeader className="relative overflow-hidden border-b bg-gradient-to-br from-primary/[0.09] via-card to-card p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-background/80 text-primary shadow-sm">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 pt-0.5">
              <CardTitle className="text-xl">ChatGPT integration</CardTitle>
              <CardDescription className="max-w-xl leading-relaxed">
                Tailor your resume, apply for the role, then save the full application to Jobnest from the same conversation.
              </CardDescription>
            </div>
          </div>
          <span role="status" className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
            connected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : loaded && credential
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-border bg-background/80 text-muted-foreground"
          }`}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : connected ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : loaded && credential ? <Unplug className="h-3.5 w-3.5" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {connectionLabel}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        <section aria-labelledby="chatgpt-connection-heading" className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0 space-y-1.5">
              <h4 id="chatgpt-connection-heading" className="text-sm font-semibold">Your Jobnest connection</h4>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {loading
                  ? "Checking whether ChatGPT can access this account."
                  : connected
                    ? "Ready to check for duplicate applications and save jobs when you type JOBNEST."
                    : credential
                      ? "This connection has expired. Reconnect it to keep using Jobnest in ChatGPT."
                      : loaded
                        ? "Connect once with secure Jobnest sign-in. No API key is required."
                        : "Refresh the status, then use the setup guide if the connection is unavailable."}
              </p>
            </div>
            <Button
              type="button"
              variant={connected ? "outline" : "default"}
              className="shrink-0 self-start sm:self-center"
              aria-expanded={setupOpen}
              aria-controls="chatgpt-setup-guide"
              onClick={toggleSetupGuide}
            >
              {setupOpen ? "Close setup" : connected ? "View setup" : credential ? "Reconnect" : "Connect ChatGPT"}
              <ChevronDown className={`transition-transform ${setupOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </Button>
          </div>

          {!loading && loaded && credential && (
            <dl className="grid border-t bg-muted/20 text-xs sm:grid-cols-3 sm:divide-x">
              <div className="space-y-1 border-b px-4 py-3 sm:border-b-0"><dt className="text-muted-foreground">Connected</dt><dd className="font-medium text-foreground">{formatDateTime(credential.created_at)}</dd></div>
              <div className="space-y-1 border-b px-4 py-3 sm:border-b-0"><dt className="text-muted-foreground">Last saved</dt><dd className="font-medium text-foreground">{credential.last_used_at ? formatDateTime(credential.last_used_at) : "No jobs saved yet"}</dd></div>
              <div className="space-y-1 px-4 py-3"><dt className="text-muted-foreground">Access expires</dt><dd className="font-medium text-foreground">{credential.expires_at ? formatDateTime(credential.expires_at) : "No expiry"}</dd></div>
            </dl>
          )}

          {error && <p role="alert" className="mx-4 mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive sm:mx-5">{error}</p>}

          <div className="flex flex-wrap items-center gap-1 border-t px-3 py-2">
            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={loading || busy} onClick={refresh}>
              <RefreshCw aria-hidden="true" /> Refresh
            </Button>
            {loaded && credential && (
              <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={loading || busy} onClick={() => setConfirmDisconnect(true)}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Unplug aria-hidden="true" />} Disconnect
              </Button>
            )}
          </div>

          {confirmDisconnect && (
            <div className="m-4 mt-0 space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:m-5 sm:mt-0">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Disconnect ChatGPT?</p>
                <p className="text-sm leading-relaxed text-muted-foreground">ChatGPT will lose permission to check and save jobs. Applications already in Jobnest will stay here.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void disconnect()}>Disconnect</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Keep connected</Button>
              </div>
            </div>
          )}
        </section>

        {!setup.ready && (
          <div role="status" className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <Settings2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Setup is not available on this deployment</p>
              <p className="text-sm leading-relaxed opacity-80">Jobnest needs a public HTTPS address before ChatGPT can connect. Localhost and private network addresses are not supported.</p>
            </div>
          </div>
        )}

        <section ref={setupGuide} id="chatgpt-setup-guide" aria-labelledby="chatgpt-setup-heading" tabIndex={-1} className="scroll-mt-6 overflow-hidden rounded-xl border border-primary/20 shadow-sm outline-none" hidden={!setupOpen}>
          <div className="border-b bg-primary/[0.05] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 id="chatgpt-setup-heading" className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="h-4 w-4 text-primary" aria-hidden="true" /> Connect ChatGPT to Jobnest</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">Three steps · secure OAuth sign-in · no API key</p>
              </div>
              <span className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">About 2 min</span>
            </div>
          </div>

          <ol className="divide-y">
            <li className="grid gap-3 p-4 sm:grid-cols-[2.5rem_1fr] sm:p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">1</span>
              <div className="space-y-1.5">
                <h5 className="text-sm font-semibold">Enable Developer mode</h5>
                <p className="text-sm leading-relaxed text-muted-foreground">In ChatGPT, open <strong className="font-medium text-foreground">Settings &rarr; Security and login &rarr; Developer mode</strong>. Availability depends on your account and workspace policy.</p>
              </div>
            </li>
            <li className="grid gap-3 p-4 sm:grid-cols-[2.5rem_1fr] sm:p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">2</span>
              <div className="min-w-0 space-y-3">
                <div className="space-y-1.5">
                  <h5 className="text-sm font-semibold">Add the Jobnest plugin</h5>
                  <p className="text-sm leading-relaxed text-muted-foreground">Open <strong className="font-medium text-foreground">Plugins</strong>, choose add (+), name it <strong className="font-medium text-foreground">Jobnest</strong>, paste the URL below, and select <strong className="font-medium text-foreground">OAuth</strong> with automatic discovery.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="chatgpt-mcp-url" className="text-xs font-medium text-muted-foreground">MCP server URL</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input ref={urlInput} id="chatgpt-mcp-url" value={setup.ready ? setup.mcpUrl : "Available after public HTTPS setup"} readOnly spellCheck={false} className="min-w-0 bg-background font-mono text-xs" />
                    <Button type="button" variant="outline" className="shrink-0" disabled={!setup.ready} onClick={() => void copyUrl()}>
                      <Copy aria-hidden="true" /> Copy URL
                    </Button>
                  </div>
                </div>
              </div>
            </li>
            <li className="grid gap-3 p-4 sm:grid-cols-[2.5rem_1fr] sm:p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">3</span>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <h5 className="text-sm font-semibold">Sign in and allow both actions</h5>
                  <p className="text-sm leading-relaxed text-muted-foreground">Sign in to Jobnest, approve <strong className="font-medium text-foreground">Check and save job applications</strong>, then finish installing the plugin.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold"><Search className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Read-only check</p>
                    <code className="mt-1 block break-all text-[11px] text-muted-foreground">check_existing_application</code>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Save application</p>
                    <code className="mt-1 block break-all text-[11px] text-muted-foreground">save_job_application</code>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">Permit both actions in ChatGPT&apos;s connection settings. Managed workspaces may require administrator approval. Jobnest supports one active ChatGPT connection per account.</p>
              </div>
            </li>
          </ol>

          <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-muted-foreground">Need ChatGPT-specific help?</p>
            <a href="https://developers.openai.com/plugins/quickstart" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Open plugin setup guide <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </section>

        <section aria-labelledby="chatgpt-workflow-heading" className="space-y-3">
          <div className="space-y-1">
            <h4 id="chatgpt-workflow-heading" className="text-sm font-semibold">Your everyday workflow</h4>
            <p className="text-sm text-muted-foreground">Keep working in ChatGPT. Jobnest acts only after the final trigger.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            <li className="relative rounded-xl border bg-muted/20 p-4">
              <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-background text-primary shadow-sm"><FileText className="h-4 w-4" aria-hidden="true" /></span>
              <p className="text-sm font-semibold">1. Tailor</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Discuss the job and prepare your tailored resume in ChatGPT.</p>
            </li>
            <li className="relative rounded-xl border bg-muted/20 p-4">
              <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-background text-primary shadow-sm"><BriefcaseBusiness className="h-4 w-4" aria-hidden="true" /></span>
              <p className="text-sm font-semibold">2. Apply</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Submit the application through the employer or job platform.</p>
            </li>
            <li className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
              <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><MessageSquare className="h-4 w-4" aria-hidden="true" /></span>
              <p className="text-sm font-semibold">3. Type JOBNEST</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">ChatGPT checks for a match, fills verified details, and saves the application.</p>
            </li>
          </ol>
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Nothing is researched, checked, or saved before you type <strong className="font-semibold text-foreground">JOBNEST</strong>. It means you already applied, so ChatGPT uses today&apos;s date without asking again.
          </div>
        </section>

        <section aria-labelledby="chatgpt-help-heading" className="space-y-3">
          <div className="space-y-1">
            <h4 id="chatgpt-help-heading" className="text-sm font-semibold">Help and optional setup</h4>
            <p className="text-sm text-muted-foreground">Open only what you need.</p>
          </div>
          <div className="grid gap-3">
            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <HelpCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">Jobnest is not working in ChatGPT</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:inline">Reconnect</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t px-4 py-4 text-sm sm:px-11">
                <p className="mb-3 leading-relaxed text-muted-foreground">If Jobnest cannot check or save an application, reconnect it:</p>
                <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
                  <li>Open ChatGPT <strong className="font-medium text-foreground">Settings &rarr; Plugins</strong> and select Jobnest.</li>
                  <li>Choose reconnect if available. Otherwise remove the connection and add it again with the MCP URL in the setup guide.</li>
                  <li>Sign in to Jobnest and approve <strong className="font-medium text-foreground">Check and save job applications</strong>.</li>
                  <li>Permit both <code className="break-all text-xs text-foreground">check_existing_application</code> and <code className="break-all text-xs text-foreground">save_job_application</code>.</li>
                </ol>
              </div>
            </details>

            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">Use Jobnest in projects and folders</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:inline">Optional</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="space-y-3 border-t px-4 py-4 text-sm sm:px-11">
                <p className="leading-relaxed text-muted-foreground">Paste this line at the very top of the project or folder instructions. It keeps Jobnest available without saving anything early.</p>
                <div className="space-y-1.5">
                  <label htmlFor="chatgpt-folder-instruction" className="text-xs font-medium text-muted-foreground">Project or folder instruction</label>
                  <Textarea ref={folderInstructionInput} id="chatgpt-folder-instruction" value={CHATGPT_FOLDER_INSTRUCTION} readOnly spellCheck={false} rows={3} className="resize-none bg-muted/20 font-mono text-xs" />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyFolderInstruction()}><Copy aria-hidden="true" /> Copy instruction</Button>
              </div>
            </details>

            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">What Jobnest checks and saves</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-3 border-t px-4 py-4 text-sm sm:grid-cols-2 sm:px-11">
                <div className="space-y-1.5">
                  <p className="font-medium">Before saving</p>
                  <p className="leading-relaxed text-muted-foreground">ChatGPT researches missing public details and checks the same company, role, and location. If a match exists, it warns you instead of creating another record.</p>
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium">Saved to Jobnest</p>
                  <p className="leading-relaxed text-muted-foreground">The posting URL, location, full description, and every other verified field available in the conversation or research.</p>
                </div>
              </div>
            </details>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
