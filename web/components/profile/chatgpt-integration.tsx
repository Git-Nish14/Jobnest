"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, MessageSquare, RefreshCw, Unplug } from "lucide-react";
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

  return (
    <Card id="chatgpt" className="scroll-mt-8">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <CardTitle>Set up ChatGPT plugin</CardTitle>
            <CardDescription>
              Tailor your resume in ChatGPT, then type JOBNEST after applying to save the job here.
              Connect your Jobnest account once to get started.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Plugin access and Developer mode depend on your ChatGPT account and workspace settings.
          You sign in securely with Jobnest; no API key is needed.
        </p>

        {!setup.ready && (
          <p role="status" className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Plugin setup is not available on this deployment yet. Jobnest needs a configured, publicly
            reachable HTTPS address before ChatGPT can connect. Localhost and private network addresses will not work.
          </p>
        )}

        <section aria-labelledby="chatgpt-connection-heading" className="space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="chatgpt-connection-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4" aria-hidden="true" /> Your connection
            </h3>
            <Button type="button" size="sm" variant="ghost" disabled={loading || busy} onClick={refresh}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh status
            </Button>
          </div>
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading connection status...
            </p>
          ) : loaded && credential ? (
            <div className="space-y-3">
              <p role="status" className="flex items-center gap-2 text-sm font-medium">
                {expired ? <Unplug className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />}
                {expired ? "Connection expired" : "Account connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {expired
                  ? "Reconnect Jobnest in ChatGPT to save more applications."
                  : "Your account has granted access. Save a job from ChatGPT to check that the plugin is working."}
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Connected</dt><dd>{formatDateTime(credential.created_at)}</dd></div>
                <div><dt className="text-muted-foreground">Expires</dt><dd>{credential.expires_at ? formatDateTime(credential.expires_at) : "No expiry"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Last successful save</dt><dd>{credential.last_used_at ? formatDateTime(credential.last_used_at) : "No jobs saved through this connection yet"}</dd></div>
              </dl>
            </div>
          ) : loaded ? (
            <p role="status" className="text-sm text-muted-foreground">Not connected. Follow the steps below to connect your account from ChatGPT.</p>
          ) : null}

          {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          {loaded && credential && (
            <Button type="button" size="sm" variant="outline" disabled={loading || busy} onClick={() => setConfirmDisconnect(true)}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Unplug aria-hidden="true" />} Disconnect ChatGPT
            </Button>
          )}
          {confirmDisconnect && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm">Disconnect ChatGPT? It will lose permission to save jobs. Your existing job records will stay in Jobnest.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void disconnect()}>Confirm disconnect</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </section>

        <ol className="list-decimal space-y-5 pl-5 text-sm marker:font-semibold marker:text-primary">
          <li className="space-y-2 pl-1">
            <p><strong>Enable Developer mode in ChatGPT.</strong> Open Settings → Security and login → Developer mode, if available. Your workspace may need to allow it.</p>
          </li>
          <li className="space-y-2 pl-1">
            <p><strong>Add the Jobnest plugin.</strong> Open Plugins and use the add (+) option. Name the plugin <strong>Jobnest</strong> and paste this MCP server URL. Select <strong>OAuth</strong> and use automatic discovery for authentication.</p>
            <label htmlFor="chatgpt-mcp-url" className="block text-xs font-medium text-muted-foreground">Jobnest MCP server URL</label>
            <div className="flex items-center gap-2">
              <Input ref={urlInput} id="chatgpt-mcp-url" value={setup.ready ? setup.mcpUrl : "Available after public HTTPS setup"} readOnly spellCheck={false} className="min-w-0 font-mono text-xs" />
              <Button type="button" size="icon" variant="outline" aria-label="Copy Jobnest MCP server URL" disabled={!setup.ready} onClick={() => void copyUrl()}><Copy aria-hidden="true" /></Button>
            </div>
          </li>
          <li className="space-y-2 pl-1">
            <p><strong>Connect your Jobnest account.</strong> Sign in to Jobnest when prompted, review the request, and choose <strong>Connect</strong> to allow saving job applications. Finish installing your personal plugin in ChatGPT.</p>
            <p className="text-muted-foreground">Jobnest supports one active ChatGPT connection per account. Reconnecting replaces the previous connection.</p>
          </li>
          <li className="space-y-2 pl-1">
            <p><strong>Allow the save action.</strong> Open the Jobnest connection settings in ChatGPT and make sure its Actions control permits <strong>save_job_application</strong>. Choose an App permissions option that allows changes; ChatGPT may ask before every save. In a managed Business or Enterprise workspace, an administrator may need to approve the write action.</p>
          </li>
          <li className="space-y-2 pl-1">
            <p><strong>Keep Jobnest enabled in a ChatGPT folder.</strong> If you use a ChatGPT folder or project, paste this line at the very top of its instructions, above every other instruction. This keeps Jobnest available without saving anything early.</p>
            <label htmlFor="chatgpt-folder-instruction" className="block text-xs font-medium text-muted-foreground">Folder/project instruction</label>
            <div className="flex items-start gap-2">
              <Textarea ref={folderInstructionInput} id="chatgpt-folder-instruction" value={CHATGPT_FOLDER_INSTRUCTION} readOnly spellCheck={false} rows={3} className="min-w-0 resize-none font-mono text-xs" />
              <Button type="button" size="icon" variant="outline" aria-label="Copy ChatGPT folder instruction" onClick={() => void copyFolderInstruction()}><Copy aria-hidden="true" /></Button>
            </div>
            <p className="text-muted-foreground">Use this folder instruction because the plugin may not remain available in folder chats unless <strong>@Jobnest</strong> is included in the instructions.</p>
          </li>
          <li className="space-y-2 pl-1">
            <p><strong>Save your next application.</strong> In a normal conversation, add Jobnest from the tools menu or select <strong>@Jobnest</strong>. After applying, type <strong>JOBNEST</strong>. ChatGPT will fill every supported detail it can, attach the job URL and description, and save with today&apos;s date. If the posting URL is not in the chat, ChatGPT will ask you to provide it before saving.</p>
            <p className="text-muted-foreground">Approve the ChatGPT save prompt and wait for the saved Jobnest link. If ChatGPT says the conversation does not permit the action, enable Jobnest for that conversation and check its Actions/App permissions. Use Refresh status above to check your last successful save.</p>
          </li>
        </ol>

        <a href="https://developers.openai.com/plugins/quickstart" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4">
          OpenAI&apos;s plugin setup guide <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </CardContent>
    </Card>
  );
}
