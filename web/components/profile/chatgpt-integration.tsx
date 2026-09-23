"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, ExternalLink, FolderOpen, HelpCircle, Link2, Loader2, MessageSquare, RefreshCw, Unplug } from "lucide-react";
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

  const connected = loaded && Boolean(credential) && !expired;

  return (
    <Card id="chatgpt" className="scroll-mt-8 overflow-hidden">
      <CardHeader className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 pt-0.5">
            <CardTitle className="text-lg">ChatGPT</CardTitle>
            <CardDescription className="max-w-xl leading-relaxed">
              Tailor your resume in ChatGPT, then save your applications to Jobnest without leaving the conversation.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        <section aria-labelledby="chatgpt-connection-heading" className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <h4 id="chatgpt-connection-heading" className="text-sm font-semibold">
                <span role="status" className="flex items-center gap-2">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> Checking connection...</>
                ) : connected ? (
                  <><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> Account connected</>
                ) : loaded && credential ? (
                  <><Unplug className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Connection expired</>
                ) : loaded ? (
                  <><Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Not connected</>
                ) : (
                  <><Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Connection unavailable</>
                )}
                </span>
              </h4>
              {!loading && loaded && (
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {connected
                    ? "Your account has granted access. Save a job from ChatGPT to check that the plugin is working."
                    : credential
                      ? "Reconnect Jobnest in ChatGPT to save more applications."
                      : "Connect your Jobnest account once to start saving jobs."}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant={connected ? "outline" : "default"}
              className="shrink-0 self-start sm:self-center"
              aria-expanded={setupOpen}
              aria-controls="chatgpt-setup-guide"
              onClick={() => setSetupOpen(!setupOpen)}
            >
              {setupOpen ? "Hide setup guide" : connected ? "Setup guide" : loaded && credential ? "Reconnect ChatGPT" : "Set up ChatGPT"}
              <ChevronDown className={setupOpen ? "rotate-180" : ""} aria-hidden="true" />
            </Button>
          </div>

          {!loading && loaded && credential && (
            <dl className="grid gap-4 border-t pt-4 text-xs sm:grid-cols-3">
              <div className="space-y-1"><dt className="text-muted-foreground">Connected</dt><dd className="font-medium">{formatDateTime(credential.created_at)}</dd></div>
              <div className="space-y-1"><dt className="text-muted-foreground">Expires</dt><dd className="font-medium">{credential.expires_at ? formatDateTime(credential.expires_at) : "No expiry"}</dd></div>
              <div className="space-y-1"><dt className="text-muted-foreground">Last successful save</dt><dd className="font-medium">{credential.last_used_at ? formatDateTime(credential.last_used_at) : "No jobs saved yet"}</dd></div>
            </dl>
          )}

          {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-1 border-t pt-3">
            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={loading || busy} onClick={refresh}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh status
            </Button>
            {loaded && credential && (
              <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={loading || busy} onClick={() => setConfirmDisconnect(true)}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Unplug aria-hidden="true" />} Disconnect
              </Button>
            )}
          </div>
          {confirmDisconnect && (
            <div className="space-y-3 rounded-lg border bg-card p-3">
              <p className="text-sm leading-relaxed">Disconnect ChatGPT? It will lose permission to save jobs. Your existing job records will stay in Jobnest.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void disconnect()}>Confirm disconnect</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </section>

        {!setup.ready && (
          <p role="status" className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Plugin setup is not available on this deployment yet. Jobnest needs a configured, publicly
            reachable HTTPS address before ChatGPT can connect. Localhost and private network addresses will not work.
          </p>
        )}

        <section id="chatgpt-setup-guide" aria-labelledby="chatgpt-setup-heading" hidden={!setupOpen} className="space-y-5">
          <div className="space-y-1.5">
            <h4 id="chatgpt-setup-heading" className="text-sm font-semibold">Connect in three steps</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Plugin access and Developer mode depend on your ChatGPT account and workspace settings.
              You sign in securely with Jobnest; no API key is needed.
            </p>
          </div>
          <ol role="list" className="space-y-5 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">1</span>
              <div className="min-w-0 space-y-1.5 pt-0.5">
                <h5 className="font-semibold">Enable Developer mode</h5>
                <p className="leading-relaxed text-muted-foreground">In ChatGPT, open Settings &rarr; Security and login &rarr; Developer mode, if available. Your workspace may need to allow it.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">2</span>
              <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                <div className="space-y-1.5">
                  <h5 className="font-semibold">Add the Jobnest plugin</h5>
                  <p className="leading-relaxed text-muted-foreground">Open Plugins and use the add (+) option. Name the plugin <strong className="font-medium text-foreground">Jobnest</strong> and paste this MCP server URL. Select <strong className="font-medium text-foreground">OAuth</strong> and use automatic discovery for authentication.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="chatgpt-mcp-url" className="block text-xs font-medium text-muted-foreground">Jobnest MCP server URL</label>
                  <div className="flex items-center gap-2">
                    <Input ref={urlInput} id="chatgpt-mcp-url" value={setup.ready ? setup.mcpUrl : "Available after public HTTPS setup"} readOnly spellCheck={false} className="min-w-0 bg-background font-mono text-xs" />
                    <Button type="button" size="icon" variant="outline" className="shrink-0" aria-label="Copy Jobnest MCP server URL" disabled={!setup.ready} onClick={() => void copyUrl()}><Copy aria-hidden="true" /></Button>
                  </div>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">3</span>
              <div className="min-w-0 space-y-2 pt-0.5">
                <h5 className="font-semibold">Connect your account and allow saves</h5>
                <p className="leading-relaxed text-muted-foreground">Sign in to Jobnest when prompted, review the request, and choose <strong className="font-medium text-foreground">Connect</strong> to allow saving job applications. Finish installing your personal plugin in ChatGPT.</p>
                <p className="leading-relaxed text-muted-foreground">Open the Jobnest connection settings in ChatGPT and make sure its Actions control permits <strong className="break-all font-medium text-foreground">save_job_application</strong>. Choose an App permissions option that allows changes; ChatGPT may ask before every save. In a managed Business or Enterprise workspace, an administrator may need to approve the write action.</p>
                <p className="text-xs leading-relaxed text-muted-foreground">Jobnest supports one active ChatGPT connection per account. Reconnecting replaces the previous connection.</p>
              </div>
            </li>
          </ol>
          <a href="https://developers.openai.com/plugins/quickstart" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            OpenAI&apos;s plugin setup guide <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </section>

        <div className="divide-y rounded-xl border">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">Saving jobs & troubleshooting</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:pl-11">
              <p>In a normal conversation, add Jobnest from the tools menu or select <strong className="font-medium text-foreground">@Jobnest</strong>. After applying, type <strong className="font-medium text-foreground">JOBNEST</strong>. ChatGPT will fill every supported detail it can, attach the job URL and description, and save with today&apos;s date. If the posting URL is not in the chat, ChatGPT will ask you to provide it before saving.</p>
              <p>Approve the ChatGPT save prompt and wait for the saved Jobnest link. If ChatGPT says the conversation does not permit the action, enable Jobnest for that conversation and check its Actions/App permissions. Use Refresh status above to check your last successful save.</p>
            </div>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">Using ChatGPT projects & folders</span>
              <span className="hidden text-xs font-normal text-muted-foreground sm:inline">Optional</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:pl-11">
              <p>If you use a ChatGPT folder or project, paste this line at the very top of its instructions, above every other instruction. This keeps Jobnest available without saving anything early.</p>
              <div className="space-y-1.5">
                <label htmlFor="chatgpt-folder-instruction" className="block text-xs font-medium">Folder/project instruction</label>
                <div className="flex items-start gap-2">
                  <Textarea ref={folderInstructionInput} id="chatgpt-folder-instruction" value={CHATGPT_FOLDER_INSTRUCTION} readOnly spellCheck={false} rows={3} className="min-w-0 resize-none bg-background font-mono text-xs" />
                  <Button type="button" size="icon" variant="outline" className="shrink-0" aria-label="Copy ChatGPT folder instruction" onClick={() => void copyFolderInstruction()}><Copy aria-hidden="true" /></Button>
                </div>
              </div>
              <p>Use this folder instruction because the plugin may not remain available in folder chats unless <strong className="font-medium text-foreground">@Jobnest</strong> is included in the instructions.</p>
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
