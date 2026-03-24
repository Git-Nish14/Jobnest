"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Sparkles, Loader2, Trash2, Plus, PanelLeftClose, PanelLeft,
  MoreHorizontal, Pencil, X, Check, BrainCircuit, TrendingUp, Calendar,
  Bell, Building2, Target, MessageSquare, Zap, Copy, CheckCheck,
  Square, Pin, PinOff, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";

// ── Types ────────────────────────────────────────────────────────────────────

interface MessageAttachment {
  name: string;
  fileType: string; // 'pdf' | 'docx' | 'doc' | 'txt' | 'md'
  preview?: string; // first 3000 chars of extracted text, for in-chat viewing
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachment?: MessageAttachment;
  suggestions?: string[];
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface AttachedFile {
  name: string;
  text: string | null;  // null while loading or on error
  loading: boolean;
  error?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000;
const FOLLOW_UPS_MARKER = "\nFOLLOW_UPS:";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseFollowUps(fullText: string): { content: string; suggestions: string[] } {
  const idx = fullText.lastIndexOf(FOLLOW_UPS_MARKER);
  if (idx === -1) return { content: fullText, suggestions: [] };
  const content = fullText.slice(0, idx).trimEnd();
  const suggestionsLine = fullText.slice(idx + FOLLOW_UPS_MARKER.length).trim();
  const suggestions = suggestionsLine
    .split("|")
    .map((s) => s.replace(/^\[|\]$/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return { content, suggestions };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, label: "Application stats", prompt: "How many applications have I submitted this month?" },
  { icon: Target, label: "Success rate", prompt: "What's my overall application success rate?" },
  { icon: Building2, label: "Pending responses", prompt: "Which companies haven't responded yet?" },
  { icon: Calendar, label: "Upcoming interviews", prompt: "Do I have any upcoming interviews?" },
  { icon: Bell, label: "My reminders", prompt: "What are my pending reminders?" },
  { icon: BrainCircuit, label: "Progress summary", prompt: "Summarize my job search progress" },
];

function RateLimitCounter({
  remaining, max, resetCountdown, isRateLimited,
}: {
  remaining: number; max: number; resetCountdown: number | null; isRateLimited: boolean;
}) {
  const pips = Array.from({ length: max });
  const windowActive = resetCountdown !== null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors select-none",
        isRateLimited
          ? "border-destructive/30 bg-destructive/8 text-destructive"
          : remaining <= 1 && windowActive
          ? "border-amber-300/60 bg-amber-50 text-amber-700"
          : windowActive
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-transparent text-muted-foreground/50"
      )}
      title={`${remaining} of ${max} requests remaining.`}
    >
      <div className="flex items-center gap-0.5">
        {pips.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all duration-300",
              i < remaining
                ? isRateLimited ? "bg-destructive/50" : remaining <= 1 ? "bg-amber-400" : "bg-primary/60"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <span className="tabular-nums font-medium leading-none">
        {isRateLimited ? (
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{resetCountdown}s</span>
        ) : windowActive ? (
          <>{remaining}/{max}{resetCountdown !== null && <span className="ml-1 opacity-50">· {resetCountdown}s</span>}</>
        ) : (
          <>{max}/{max}</>
        )}
      </span>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
      <Sparkles className="h-3.5 w-3.5 text-white" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── File attachment card (shown inside user messages) ─────────────────────────

const FILE_TYPE_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pdf:  { label: "PDF",  bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  docx: { label: "DOCX", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  doc:  { label: "DOC",  bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  txt:  { label: "TXT",  bg: "bg-zinc-50",   text: "text-zinc-600",   border: "border-zinc-200" },
  md:   { label: "MD",   bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

function FileAttachmentCard({ attachment, onView }: { attachment: MessageAttachment; onView?: () => void }) {
  const meta = FILE_TYPE_META[attachment.fileType.toLowerCase()] ?? {
    label: attachment.fileType.toUpperCase(),
    bg: "bg-muted", text: "text-muted-foreground", border: "border-border",
  };

  // Trim extension from display name for cleanliness
  const displayName = attachment.name.replace(/\.[^.]+$/, "");

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 mb-2 w-fit max-w-[280px] transition-all",
        meta.bg, meta.border,
        onView && "cursor-pointer hover:shadow-sm hover:brightness-95 select-none"
      )}
      onClick={onView}
      title={onView ? "Click to view document" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") onView(); } : undefined}
    >
      {/* File icon block */}
      <div className={cn("flex h-9 w-7 shrink-0 flex-col items-center justify-between rounded-md border py-1", meta.border, "bg-white/70")}>
        <div className={cn("text-[7px] font-bold tracking-tight leading-none mt-0.5", meta.text)}>{meta.label}</div>
        <div className="flex gap-px mb-0.5">
          {[...Array(3)].map((_, i) => (
            <span key={i} className={cn("h-px w-3 rounded-full", meta.text, "opacity-30")} />
          ))}
        </div>
      </div>
      {/* Name */}
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold truncate leading-tight", meta.text)}>{displayName}</p>
        <p className={cn("text-[11px] mt-0.5 opacity-70", meta.text)}>{attachment.name.split(".").pop()?.toUpperCase()} document</p>
      </div>
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

type InlineNode = string | React.ReactElement;

function parseInline(text: string): InlineNode[] {
  const result: InlineNode[] = [];
  // Order matters: bold before italic, inline code before both
  const regex = /(`[^`]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      result.push(
        <code key={match.index} className="bg-muted rounded px-1.5 py-0.5 text-[0.8em] font-mono text-foreground border">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      result.push(<strong key={match.index} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      result.push(<em key={match.index} className="italic">{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

function MarkdownRenderer({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  // Split on fenced code blocks first so they're never processed as inline markdown
  const segments = content.split(/(```[\s\S]*?```|```[\s\S]*$)/g);
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const segment of segments) {
    if (segment.startsWith("```")) {
      const lines = segment.split("\n");
      const lang = lines[0].replace("```", "").trim();
      const isComplete = segment.endsWith("```") && segment.length > 3;
      const codeLines = isComplete ? lines.slice(1, -1) : lines.slice(1);
      const code = codeLines.join("\n");
      elements.push(
        <div key={key++} className="my-2 rounded-xl overflow-hidden border border-border/60 bg-zinc-950">
          {lang && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
              <span className="text-[11px] text-zinc-400 font-mono">{lang}</span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-[0.8em] leading-relaxed">
            <code className="text-zinc-100 font-mono">{code}</code>
          </pre>
        </div>
      );
    } else {
      // Process line-by-line
      const lines = segment.split("\n");
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) { i++; continue; }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
          elements.push(<hr key={key++} className="my-3 border-border/60" />);
          i++; continue;
        }

        // Headers
        if (line.startsWith("### ")) {
          elements.push(<h3 key={key++} className="text-sm font-semibold mt-4 mb-1 text-foreground">{parseInline(line.slice(4))}</h3>);
          i++; continue;
        }
        if (line.startsWith("## ")) {
          elements.push(<h2 key={key++} className="text-sm font-bold mt-5 mb-1.5 text-foreground">{parseInline(line.slice(3))}</h2>);
          i++; continue;
        }
        if (line.startsWith("# ")) {
          elements.push(<h1 key={key++} className="text-base font-bold mt-5 mb-2 text-foreground">{parseInline(line.slice(2))}</h1>);
          i++; continue;
        }

        // Blockquote
        if (line.startsWith("> ")) {
          elements.push(
            <blockquote key={key++} className="border-l-2 border-primary/50 pl-3 text-muted-foreground italic text-sm my-1">
              {parseInline(line.slice(2))}
            </blockquote>
          );
          i++; continue;
        }

        // Bullet list — collect consecutive items
        if (/^[-*•] /.test(line)) {
          const items: React.ReactNode[] = [];
          while (i < lines.length && /^[-*•] /.test(lines[i])) {
            items.push(<li key={i} className="leading-relaxed">{parseInline(lines[i].replace(/^[-*•] /, ""))}</li>);
            i++;
          }
          elements.push(
            <ul key={key++} className="list-disc list-outside ml-5 space-y-0.5 my-1.5 text-sm">
              {items}
            </ul>
          );
          continue;
        }

        // Numbered list
        if (/^\d+\. /.test(line)) {
          const items: React.ReactNode[] = [];
          while (i < lines.length && /^\d+\. /.test(lines[i])) {
            items.push(<li key={i} className="leading-relaxed">{parseInline(lines[i].replace(/^\d+\. /, ""))}</li>);
            i++;
          }
          elements.push(
            <ol key={key++} className="list-decimal list-outside ml-5 space-y-0.5 my-1.5 text-sm">
              {items}
            </ol>
          );
          continue;
        }

        // Regular paragraph
        elements.push(
          <p key={key++} className="text-sm leading-relaxed text-foreground">
            {parseInline(line)}
          </p>
        );
        i++;
      }
    }
  }

  return (
    <div className="space-y-1">
      {elements}
      {isStreaming && (
        <span className="inline-block w-0.5 h-[1.1em] bg-primary/70 align-text-bottom animate-pulse ml-0.5" />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NestAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rate limit
  const [remaining, setRemaining] = useState<number>(MAX_REQUESTS);
  const [windowEndAt, setWindowEndAt] = useState<number | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // File attachment
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Message editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<MessageAttachment | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Rate-limit countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (!windowEndAt) { setResetCountdown(null); return; }
    const tick = () => {
      const secsLeft = Math.ceil((windowEndAt - Date.now()) / 1000);
      if (secsLeft <= 0) {
        setRemaining(MAX_REQUESTS); setIsRateLimited(false); setError(null);
        setWindowEndAt(null); setResetCountdown(null);
      } else {
        setResetCountdown(secsLeft);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [windowEndAt]);

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => { setMenuOpenId(null); setDeleteConfirmId(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  // ── Sessions ─────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetchWithRetry("/api/nesta-ai/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const createSession = async (): Promise<string | null> => {
    try {
      const res = await fetchWithRetry("/api/nesta-ai/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [data.session, ...prev]);
        return data.session.id;
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
    return null;
  };

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const loaded: Message[] = data.session.messages.map((m: {
          id: string; role: "user" | "assistant"; content: string;
          created_at: string; metadata?: { attachment?: MessageAttachment };
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          // attachment includes preview if it was saved
          attachment: m.metadata?.attachment,
        }));
        setMessages(loaded);
        setCurrentSessionId(sessionId);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const res = await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`, { method: "DELETE" }, { retries: 1 });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) { setMessages([]); setCurrentSessionId(null); }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
    setMenuOpenId(null);
    setDeleteConfirmId(null);
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      const res = await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }, { retries: 1 });
      if (res.ok) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
      }
    } catch (err) {
      console.error("Failed to update session title:", err);
    }
    setEditingSessionId(null);
  };

  const togglePin = async (sessionId: string, currentlyPinned: boolean) => {
    const newPinned = !currentlyPinned;
    // Optimistic update
    setSessions((prev) =>
      [...prev.map((s) => (s.id === sessionId ? { ...s, is_pinned: newPinned } : s))]
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
    );
    setMenuOpenId(null);
    try {
      await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: newPinned }),
      }, { retries: 1 });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      loadSessions(); // revert on error
    }
  };

  const saveMessage = async (
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    attachment?: MessageAttachment,
  ) => {
    try {
      await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          content,
          ...(attachment ? { metadata: { attachment } } : {}),
        }),
      }, { retries: 1 });
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  // ── Edit message ─────────────────────────────────────────────────────────
  const handleEditSubmit = async (messageId: string) => {
    const trimmed = editInput.trim();
    if (!trimmed || isLoading) return;

    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // Truncate local state from the edited message onwards
    setMessages((prev) => prev.slice(0, msgIndex));
    setEditingMessageId(null);
    setEditInput("");

    // Delete from DB: the message and all after it (fire and forget)
    if (currentSessionId) {
      fetchWithRetry(
        `/api/nesta-ai/sessions/${currentSessionId}/messages?from=${messageId}`,
        { method: "DELETE" },
        { retries: 1 },
      ).catch((err) => console.error("Failed to delete messages from edit point:", err));
    }

    // Submit the edited content through the normal flow
    await handleSubmit(undefined, trimmed);
  };

  // ── File attachment — non-blocking ───────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) { setError("File exceeds 5 MB limit"); return; }

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "txt" || ext === "md") {
      // Instant — read in browser, no server trip
      const text = await file.text();
      setAttachedFile({ name: file.name, text: text.slice(0, 10000), loading: false });
      return;
    }

    // PDF / DOCX — show chip immediately, parse in background
    setAttachedFile({ name: file.name, text: null, loading: true });

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/nesta-ai/parse-file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setAttachedFile({ name: file.name, text: null, loading: false, error: data.error || "Could not extract text" });
      } else {
        setAttachedFile({ name: file.name, text: data.text, loading: false });
      }
    } catch {
      setAttachedFile({ name: file.name, text: null, loading: false, error: "Failed to process file" });
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const startNewChat = () => {
    setMessages([]); setCurrentSessionId(null); setError(null);
    setAttachedFile(null);
    inputRef.current?.focus();
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  const handleSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    e?.preventDefault();
    const baseQuestion = promptOverride || input.trim();
    if (!baseQuestion || isLoading || isRateLimited) return;

    // File still parsing — don't send yet
    if (attachedFile?.loading) {
      setError("File is still being processed — please wait a moment before sending.");
      setIsLoading(false);
      return;
    }

    const question = baseQuestion;
    // File content sent as separate fields so it bypasses the 2000-char question limit
    const filePayload = attachedFile?.text
      ? { fileContent: attachedFile.text, fileName: attachedFile.name }
      : {};

    const historySnapshot = messages.map((m) => ({ role: m.role, content: m.content }));

    const msgAttachment: MessageAttachment | undefined =
      attachedFile && !attachedFile.error
        ? {
            name: attachedFile.name,
            fileType: attachedFile.name.split(".").pop() ?? "txt",
            preview: attachedFile.text?.slice(0, 3000) ?? undefined,
          }
        : undefined;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: baseQuestion,
      timestamp: new Date(),
      attachment: msgAttachment,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedFile(null);
    setIsLoading(true);
    setError(null);

    // Optimistic rate limit decrement
    setRemaining((prev) => Math.max(0, prev - 1));
    setWindowEndAt((prev) => prev ?? Date.now() + WINDOW_MS);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (sessionId) {
        setCurrentSessionId(sessionId);
        updateSessionTitle(sessionId, baseQuestion.slice(0, 60) + (baseQuestion.length > 60 ? "…" : ""));
      }
    }
    if (sessionId) saveMessage(sessionId, "user", baseQuestion, msgAttachment);

    // Placeholder streaming message
    const assistantMsgId = `${Date.now() + 1}`;
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true }]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/nesta-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historySnapshot.slice(-100), ...filePayload }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to get response" }));
        if (res.status === 429 && data.resetIn) {
          setIsRateLimited(true); setRemaining(0);
          setWindowEndAt(Date.now() + data.resetIn * 1000);
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        throw new Error(data.error || "Failed to get response");
      }

      // Sync rate limit from headers
      const rlRemaining = parseInt(res.headers.get("X-RateLimit-Remaining") ?? String(MAX_REQUESTS), 10);
      const rlResetIn = parseInt(res.headers.get("X-RateLimit-Reset-In") ?? "0", 10);
      setRemaining(rlRemaining);
      if (rlResetIn > 0) setWindowEndAt(Date.now() + rlResetIn * 1000);
      if (rlRemaining === 0) setIsRateLimited(true);

      // Stream body
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m))
        );
      }

      // Parse follow-up suggestions out of the streamed content
      const { content, suggestions } = parseFollowUps(fullContent);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content, suggestions, isStreaming: false } : m
        )
      );

      if (sessionId) saveMessage(sessionId, "assistant", content);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User stopped — keep whatever was streamed so far
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content || "(Response stopped)", isStreaming: false }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const formatRelativeDate = (dateStr: string) => {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // ── Derived sidebar groups ────────────────────────────────────────────────
  const pinnedSessions = sessions.filter((s) => s.is_pinned);
  const unpinnedSessions = sessions.filter((s) => !s.is_pinned);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-[calc(100vh-4rem)] sm:h-[calc(100vh-4.5rem)] overflow-hidden rounded-xl border bg-white shadow-sm">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className={cn(
        "flex flex-col border-r bg-muted/30 transition-all duration-300 shrink-0",
        sidebarOpen
          ? "w-64 fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto rounded-l-xl"
          : "w-0 overflow-hidden border-r-0"
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b shrink-0">
          <span className="text-sm font-semibold text-foreground pl-1">NESTAi</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={startNewChat} title="New chat">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)} title="Close sidebar">
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessionsLoading ? (
            <div className="space-y-1 p-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2.5 rounded-lg">
                  <Skeleton className="h-4 w-4 rounded shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {pinnedSessions.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-2 pt-1 pb-0.5 font-medium">Pinned</p>
                  {pinnedSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={currentSessionId === session.id}
                      isEditing={editingSessionId === session.id}
                      editTitle={editTitle}
                      menuOpenId={menuOpenId}
                      deleteConfirmId={deleteConfirmId}
                      onLoad={loadSession}
                      onDelete={deleteSession}
                      onTogglePin={togglePin}
                      onRenameStart={(s) => { setEditTitle(s.title); setEditingSessionId(s.id); setMenuOpenId(null); }}
                      onRenameChange={setEditTitle}
                      onRenameSave={updateSessionTitle}
                      onRenameCancel={() => setEditingSessionId(null)}
                      onMenuToggle={(id) => { setMenuOpenId((prev) => (prev === id ? null : id)); setDeleteConfirmId(null); }}
                      onDeleteConfirm={setDeleteConfirmId}
                      formatRelativeDate={formatRelativeDate}
                    />
                  ))}
                  {unpinnedSessions.length > 0 && <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-2 pt-2 pb-0.5 font-medium">Recent</p>}
                </>
              )}
              {unpinnedSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isActive={currentSessionId === session.id}
                  isEditing={editingSessionId === session.id}
                  editTitle={editTitle}
                  menuOpenId={menuOpenId}
                  deleteConfirmId={deleteConfirmId}
                  onLoad={loadSession}
                  onDelete={deleteSession}
                  onTogglePin={togglePin}
                  onRenameStart={(s) => { setEditTitle(s.title); setEditingSessionId(s.id); setMenuOpenId(null); }}
                  onRenameChange={setEditTitle}
                  onRenameSave={updateSessionTitle}
                  onRenameCancel={() => setEditingSessionId(null)}
                  onMenuToggle={(id) => { setMenuOpenId((prev) => (prev === id ? null : id)); setDeleteConfirmId(null); }}
                  onDeleteConfirm={setDeleteConfirmId}
                  formatRelativeDate={formatRelativeDate}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)} title="Open sidebar">
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold">NESTAi</span>
              <span className="hidden sm:inline text-xs text-muted-foreground border rounded-full px-2 py-0.5">Job search assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RateLimitCounter remaining={remaining} max={MAX_REQUESTS} resetCountdown={resetCountdown} isRateLimited={isRateLimited} />
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={startNewChat} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-3.5 w-3.5" /> New chat
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="w-full max-w-xl">
                <div className="text-center mb-8">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                    <BrainCircuit className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight">How can I help you?</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
                    Ask me anything about your applications, interviews, or job search progress.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSubmit(undefined, item.prompt)}
                      className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3.5 text-left transition-all hover:bg-muted/60 hover:border-border/80 group"
                    >
                      <div className="mt-0.5 shrink-0 h-7 w-7 rounded-lg bg-background border flex items-center justify-center group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                        <item.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <div className="flex flex-col items-end gap-1 group/msg">
                      {msg.attachment && (
                        <FileAttachmentCard
                          attachment={msg.attachment}
                          onView={msg.attachment.preview !== undefined
                            ? () => setPreviewDoc(msg.attachment!)
                            : undefined}
                        />
                      )}
                      {editingMessageId === msg.id ? (
                        /* ── Inline editor ── */
                        <div className="w-full max-w-[85%] space-y-2">
                          <textarea
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            autoFocus
                            aria-label="Edit message"
                            title="Edit message"
                            placeholder="Edit your message…"
                            rows={Math.max(2, editInput.split("\n").length)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(msg.id); }
                              if (e.key === "Escape") { setEditingMessageId(null); setEditInput(""); }
                            }}
                            className="w-full rounded-2xl rounded-tr-sm border-2 border-primary/40 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setEditingMessageId(null); setEditInput(""); }}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={() => handleEditSubmit(msg.id)} disabled={!editInput.trim() || isLoading}>
                              Send
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ── Normal bubble + edit button ── */
                        <div className="flex items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setEditingMessageId(msg.id); setEditInput(msg.content); }}
                            disabled={isLoading}
                            title="Edit message"
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 mb-0.5 disabled:pointer-events-none"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <div className="max-w-[80%] bg-muted rounded-2xl rounded-tr-sm px-4 py-2.5">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-3 group">
                      <AssistantAvatar />
                      <div className="flex-1 min-w-0">
                        <MarkdownRenderer content={msg.content} isStreaming={msg.isStreaming} />
                        {!msg.isStreaming && (
                          <>
                            <div className="flex items-center gap-1 mt-1.5">
                              <CopyButton text={msg.content} />
                              <span className="text-[11px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {msg.suggestions && msg.suggestions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {msg.suggestions.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleSubmit(undefined, s)}
                                    disabled={isLoading || isRateLimited}
                                    className="text-xs px-3 py-1.5 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator — only while loading before first token arrives */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <AssistantAvatar />
                  <div className="flex items-center gap-1 pt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm">
              <span>{error}</span>
              <button type="button" aria-label="Dismiss error" onClick={() => setError(null)} className="hover:opacity-70 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="max-w-2xl mx-auto">
            {isRateLimited && resetCountdown ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4">
                <div className="h-1 w-full rounded-full bg-destructive/15 mb-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive/40 transition-all duration-1000"
                    style={{ width: `${Math.max(0, (resetCountdown / (WINDOW_MS / 1000)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-destructive">Rate limit reached</p>
                      <p className="text-xs text-destructive/70">You&apos;ve used all {MAX_REQUESTS} requests for this minute</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold tabular-nums text-destructive leading-none">{resetCountdown}s</p>
                    <p className="text-[11px] text-destructive/60 mt-0.5">until reset</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Attached file chip */}
                {attachedFile && (
                  <div className={cn(
                    "mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border w-fit max-w-full",
                    attachedFile.error
                      ? "bg-destructive/8 border-destructive/25 text-destructive"
                      : attachedFile.loading
                      ? "bg-muted border-border text-muted-foreground"
                      : "bg-primary/8 border-primary/20 text-primary"
                  )}>
                    {attachedFile.loading
                      ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      : attachedFile.error
                      ? <X className="h-3.5 w-3.5 shrink-0" />
                      : <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span className="text-xs font-medium truncate max-w-55">
                      {attachedFile.error
                        ? `Couldn't read ${attachedFile.name} — you can still chat`
                        : attachedFile.loading
                        ? `Processing ${attachedFile.name}…`
                        : attachedFile.name
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="shrink-0 opacity-60 hover:opacity-100"
                      aria-label="Remove attached file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="relative flex items-end gap-2 rounded-2xl border bg-background shadow-sm focus-within:shadow-md focus-within:border-border/80 transition-all px-3 py-2">
                  {/* File attach button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 shrink-0 pb-1.5"
                    title="Attach file (PDF, DOCX, TXT — max 5 MB)"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    className="hidden"
                    aria-label="Attach file"
                    title="Attach file (PDF, DOCX, TXT — max 5 MB)"
                    onChange={handleFileChange}
                  />

                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={autoResize}
                    onKeyDown={handleKeyDown}
                    placeholder="Message NESTAi…"
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 py-1.5 min-h-9 max-h-[200px] leading-relaxed disabled:opacity-50"
                  />

                  {/* Stop button while streaming, send button otherwise */}
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopStreaming}
                      className="h-8 w-8 rounded-xl shrink-0 bg-foreground/10 hover:bg-foreground/20 flex items-center justify-center transition-colors"
                      title="Stop generating"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={(!input.trim() && !attachedFile) || isLoading}
                      className={cn(
                        "h-8 w-8 rounded-xl shrink-0 transition-all",
                        (input.trim() || attachedFile) && !isLoading
                          ? "bg-primary hover:bg-primary/90"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </form>
            )}

            <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
              {resetCountdown !== null
                ? `${remaining}/${MAX_REQUESTS} requests remaining · resets in ${resetCountdown}s`
                : `${MAX_REQUESTS} requests per minute · Responses based on your Jobnest data`
              }
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* ── Document preview modal ──────────────────────────────────────── */}
    {previewDoc && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setPreviewDoc(null)}
        aria-label="Close document preview"
      >
        <div
          className="bg-background rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-8 shrink-0 flex-col items-center justify-between rounded-lg border py-1",
                FILE_TYPE_META[previewDoc.fileType.toLowerCase()]?.border ?? "border-border",
                "bg-white"
              )}>
                <span className={cn("text-[7px] font-bold leading-none mt-0.5",
                  FILE_TYPE_META[previewDoc.fileType.toLowerCase()]?.text ?? "text-muted-foreground")}>
                  {(FILE_TYPE_META[previewDoc.fileType.toLowerCase()]?.label ?? previewDoc.fileType).toUpperCase()}
                </span>
                <div className="flex gap-px mb-0.5">
                  {[...Array(3)].map((_, i) => (
                    <span key={i} className={cn("h-px w-3 rounded-full opacity-30",
                      FILE_TYPE_META[previewDoc.fileType.toLowerCase()]?.text ?? "text-muted-foreground")} />
                  ))}
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">{previewDoc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewDoc.fileType.toUpperCase()} · {previewDoc.preview
                    ? `${previewDoc.preview.length.toLocaleString()} characters extracted`
                    : "No preview available"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewDoc(null)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {previewDoc.preview ? (
              <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-foreground break-words">
                {previewDoc.preview}
                {previewDoc.preview.length >= 3000 && (
                  <span className="block mt-4 text-xs text-muted-foreground not-italic font-sans border-t pt-3">
                    Preview limited to first 3,000 characters. The full document was sent to NESTAi.
                  </span>
                )}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Paperclip className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Preview not available</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  This file was attached before preview support was added.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── SessionRow ────────────────────────────────────────────────────────────────

function SessionRow({
  session, isActive, isEditing, editTitle, menuOpenId, deleteConfirmId,
  onLoad, onDelete, onTogglePin, onRenameStart, onRenameChange, onRenameSave,
  onRenameCancel, onMenuToggle, onDeleteConfirm, formatRelativeDate,
}: {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  menuOpenId: string | null;
  deleteConfirmId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRenameStart: (s: ChatSession) => void;
  onRenameChange: (v: string) => void;
  onRenameSave: (id: string, title: string) => void;
  onRenameCancel: () => void;
  onMenuToggle: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  formatRelativeDate: (d: string) => string;
}) {
  return (
    <div className={cn(
      "group relative flex items-center gap-1 rounded-lg transition-colors cursor-pointer",
      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    )}>
      {session.is_pinned && (
        <Pin className="absolute left-1.5 top-2 h-2.5 w-2.5 text-primary/40 shrink-0" />
      )}

      {isEditing ? (
        <div className="flex items-center gap-1 w-full px-2 py-1.5">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onRenameChange(e.target.value)}
            className="flex-1 text-xs bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
            autoFocus
            aria-label="Chat title"
            title="Rename chat"
            placeholder="Chat title"
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSave(session.id, editTitle);
              else if (e.key === "Escape") onRenameCancel();
            }}
          />
          <button type="button" aria-label="Save" onClick={() => onRenameSave(session.id, editTitle)} className="p-1 rounded hover:bg-green-100 text-green-600">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Cancel" onClick={onRenameCancel} className="p-1 rounded hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={cn("flex-1 text-left py-2 min-w-0", session.is_pinned ? "pl-5 pr-1" : "px-2")}
            onClick={() => onLoad(session.id)}
          >
            <p className="text-xs font-medium truncate leading-tight">{session.title}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatRelativeDate(session.updated_at)}</p>
          </button>

          <div className="relative pr-1 shrink-0">
            <button
              type="button"
              aria-label="Session options"
              className={cn(
                "p-1 rounded hover:bg-muted transition-opacity text-muted-foreground",
                menuOpenId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => { e.stopPropagation(); onMenuToggle(session.id); }}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpenId === session.id && (
              <div
                className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-30 min-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                {deleteConfirmId === session.id ? (
                  /* Confirm delete inline */
                  <div className="px-3 py-2 space-y-1.5">
                    <p className="text-xs font-medium text-destructive">Delete this chat?</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        aria-label="Confirm delete chat"
                        className="flex-1 text-xs py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                        onClick={() => onDelete(session.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel delete"
                        className="flex-1 text-xs py-1 rounded border hover:bg-muted transition-colors"
                        onClick={() => onDeleteConfirm(null as unknown as string)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 transition-colors"
                      onClick={() => onRenameStart(session)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
                    </button>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 transition-colors"
                      onClick={() => onTogglePin(session.id, session.is_pinned)}
                    >
                      {session.is_pinned
                        ? <><PinOff className="h-3.5 w-3.5 text-muted-foreground" /> Unpin</>
                        : <><Pin className="h-3.5 w-3.5 text-muted-foreground" /> Pin</>
                      }
                    </button>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive transition-colors"
                      onClick={() => onDeleteConfirm(session.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
