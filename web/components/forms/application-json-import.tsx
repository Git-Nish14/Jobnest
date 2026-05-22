"use client";

import { useState, useCallback, useMemo } from "react";
import { Braces, ClipboardPaste, X, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { getApplicationImportPrompt, parseApplicationJSON } from "@/lib/utils/resume-json";
import type { ApplicationFormData } from "@/lib/validations/application";

interface ApplicationJsonImportProps {
  onImport: (data: Partial<ApplicationFormData>, fieldsImported: string[]) => void;
}

export function ApplicationJsonImport({ onImport }: ApplicationJsonImportProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"prompt" | "paste">("prompt");

  // FIX 5 (performance/correctness): memoize today and prompt so they are computed
  // once per component mount — not on every re-render. Without this, a tab-switch
  // or any state change regenerates the ~1 KB string and invalidates handleCopy's
  // useCallback, which means the callback changes on every render.
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const prompt = useMemo(() => getApplicationImportPrompt(today), [today]);

  // FIX 4 (security/production): three-state copy instead of boolean + deprecated
  // execCommand fallback. The old fallback created a visible DOM node (screen readers
  // announce its content) and called the deprecated execCommand without checking
  // whether it actually succeeded — showing "Copied!" even on failure.
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Clipboard API blocked (non-HTTPS dev env, permission denied).
      // Do not fall back to deprecated execCommand — just tell the user to
      // select-all + copy manually; the <pre> has select-all via CSS.
      setCopyState("failed");
      setTimeout(() => setCopyState("idle"), 3000);
    }
  }, [prompt]);

  // Paste tab
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // FIX 6 (critical bug): warnings were set then immediately cleared because
  // setOpen(false) unmounts the component before React re-renders the warning UI.
  // Fix: if there are warnings, keep the modal open so the user can read them;
  // the valid fields are still applied to the form. The user closes manually.
  const handleImport = useCallback(() => {
    setError(null);
    setWarnings([]);
    setImporting(true);
    try {
      const result = parseApplicationJSON(jsonText);
      if (result.fieldsImported.length === 0 && result.warnings.length === 0) {
        setError("No recognised fields found in the JSON.");
        return;
      }
      onImport(result.data, result.fieldsImported);
      if (result.warnings.length > 0) {
        // Apply fields but keep modal open so the user can review what was skipped.
        setWarnings(result.warnings);
      } else {
        // Clean import — close and reset.
        setOpen(false);
        setJsonText("");
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse JSON.");
    } finally {
      setImporting(false);
    }
  }, [jsonText, onImport]);

  const handleClose = () => {
    setOpen(false);
    setTab("prompt");
    setJsonText("");
    setError(null);
    setWarnings([]);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Braces className="h-3.5 w-3.5" />
        Fill from JSON
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="bg-[#faf9f7] dark:bg-[#0a0a0a] rounded-2xl border shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-[#99462a]" />
                <span className="font-semibold text-sm">Fill from JSON</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b shrink-0">
              <button
                type="button"
                onClick={() => { setTab("prompt"); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                  tab === "prompt"
                    ? "bg-[#99462a] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Copy className="h-3.5 w-3.5" />
                1. Get AI prompt
              </button>
              <button
                type="button"
                onClick={() => { setTab("paste"); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                  tab === "paste"
                    ? "bg-[#99462a] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                2. Paste JSON
              </button>
            </div>

            {/* Tab content */}
            <div className="p-5 space-y-3 overflow-y-auto">
              {tab === "prompt" ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Copy this prompt and paste it into{" "}
                    <span className="font-medium text-foreground">ChatGPT, Claude, Gemini</span>, etc.
                    Add your resume and the job posting where indicated.
                  </p>
                  <div className="relative">
                    <pre className="text-[11px] leading-relaxed font-mono bg-[#f4f3f1] dark:bg-[#1a1a1a] border border-[#dbc1b9]/50 rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap break-words text-[#55433d] dark:text-white/70 select-all">
                      {prompt}
                    </pre>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    {copyState === "failed" ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Copy blocked — select all text above (Ctrl+A) and copy manually.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        The AI will return raw JSON — then switch to &ldquo;Paste JSON&rdquo; to import it.
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopy}
                      className="shrink-0"
                    >
                      {copyState === "copied" ? (
                        <><Check className="h-3.5 w-3.5 mr-1.5" />Copied!</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy prompt</>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Paste the JSON returned by the AI. Fields that match will auto-fill the form.
                  </p>
                  <textarea
                    value={jsonText}
                    onChange={(e) => { setJsonText(e.target.value); setError(null); }}
                    placeholder={'{\n  "company": "Acme Corp",\n  "position": "Software Engineer",\n  ...\n}'}
                    rows={10}
                    className="w-full rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] dark:bg-[#1a1a1a] px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#99462a]/40 resize-none"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  {warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50 px-3 py-2 space-y-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Fields applied — {warnings.length} skipped:
                      </p>
                      {warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-500 pl-5">{w}</p>
                      ))}
                      <div className="flex justify-end pt-1">
                        <Button type="button" size="sm" onClick={handleClose}>
                          Close
                        </Button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  {warnings.length === 0 && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={importing || jsonText.trim().length < 2}
                        onClick={handleImport}
                      >
                        {importing ? (
                          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Importing…</>
                        ) : (
                          <><Braces className="mr-1.5 h-3.5 w-3.5" />Import fields</>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
