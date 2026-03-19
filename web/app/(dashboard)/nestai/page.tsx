"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  Pencil,
  X,
  Check,
  BrainCircuit,
  TrendingUp,
  Calendar,
  Bell,
  Building2,
  Target,
  MessageSquare,
  Zap,
  Copy,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/utils/fetch-retry";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const SUGGESTED_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Application stats",
    prompt: "How many applications have I submitted this month?",
  },
  {
    icon: Target,
    label: "Success rate",
    prompt: "What's my overall application success rate?",
  },
  {
    icon: Building2,
    label: "Pending responses",
    prompt: "Which companies haven't responded yet?",
  },
  {
    icon: Calendar,
    label: "Upcoming interviews",
    prompt: "Do I have any upcoming interviews?",
  },
  {
    icon: Bell,
    label: "My reminders",
    prompt: "What are my pending reminders?",
  },
  {
    icon: BrainCircuit,
    label: "Progress summary",
    prompt: "Summarize my job search progress",
  },
];

// ── Rate-limit counter ───────────────────────────────────────────────────────
function RateLimitCounter({
  remaining,
  max,
  resetCountdown,
  isRateLimited,
}: {
  remaining: number;
  max: number;
  resetCountdown: number | null;
  isRateLimited: boolean;
}) {
  const pips = Array.from({ length: max });
  const windowActive = resetCountdown !== null; // timer started = user has sent ≥1 message

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
          : "border-transparent text-muted-foreground/50" // idle, no window yet
      )}
      title={`${remaining} of ${max} requests remaining. Window resets ${resetCountdown ? `in ${resetCountdown}s` : "after first message"}.`}
    >
      {/* Pip dots — always rendered so width is stable */}
      <div className="flex items-center gap-0.5">
        {pips.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all duration-300",
              i < remaining
                ? isRateLimited
                  ? "bg-destructive/50"
                  : remaining <= 1
                  ? "bg-amber-400"
                  : "bg-primary/60"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>

      {/* Text */}
      <span className="tabular-nums font-medium leading-none">
        {isRateLimited ? (
          // Rate limited — show prominent countdown
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {resetCountdown}s
          </span>
        ) : windowActive ? (
          // Window is active — show X/N and live countdown
          <>
            {remaining}/{max}
            {resetCountdown !== null && (
              <span className="ml-1 opacity-50">· {resetCountdown}s</span>
            )}
          </>
        ) : (
          // No window yet — idle state
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

const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000; // 1 minute — must match server

export default function NestAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rate-limit state — driven by an absolute window-end timestamp so there's no drift
  const [remaining, setRemaining] = useState<number>(MAX_REQUESTS);
  const [windowEndAt, setWindowEndAt] = useState<number | null>(null); // epoch ms when window resets
  const [resetCountdown, setResetCountdown] = useState<number | null>(null); // derived, display only
  const [isRateLimited, setIsRateLimited] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // Default sidebar closed on mobile (< lg), open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Drive the visible countdown from windowEndAt — tick every second, no drift
  useEffect(() => {
    if (!windowEndAt) {
      setResetCountdown(null);
      return;
    }

    const tick = () => {
      const secsLeft = Math.ceil((windowEndAt - Date.now()) / 1000);
      if (secsLeft <= 0) {
        // Window has fully expired — restore quota
        setRemaining(MAX_REQUESTS);
        setIsRateLimited(false);
        setError(null);
        setWindowEndAt(null);
        setResetCountdown(null);
      } else {
        setResetCountdown(secsLeft);
      }
    };

    tick(); // immediate so UI updates without waiting 1 s
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [windowEndAt]);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

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
        const loaded: Message[] = data.session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
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
        if (currentSessionId === sessionId) {
          setMessages([]);
          setCurrentSessionId(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
    setMenuOpenId(null);
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

  const saveMessage = async (sessionId: string, role: "user" | "assistant", content: string) => {
    try {
      await fetchWithRetry(`/api/nesta-ai/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      }, { retries: 1 });
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    e?.preventDefault();
    const question = promptOverride || input.trim();
    if (!question || isLoading || isRateLimited) return;

    // Capture history BEFORE adding the new user message
    const historySnapshot = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    // Optimistically update the counter the instant the request is sent — no waiting for server
    setRemaining((prev) => Math.max(0, prev - 1));
    setWindowEndAt((prev) => prev ?? Date.now() + WINDOW_MS);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (sessionId) {
        setCurrentSessionId(sessionId);
        updateSessionTitle(sessionId, question.slice(0, 60) + (question.length > 60 ? "…" : ""));
      }
    }
    if (sessionId) saveMessage(sessionId, "user", question);

    try {
      const res = await fetchWithRetry("/api/nesta-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: historySnapshot.slice(-10),
        }),
      }, { retries: 1, timeoutMs: 45_000 }); // generous timeout for AI + DB round-trip
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.resetIn) {
          setIsRateLimited(true);
          setRemaining(0);
          setWindowEndAt(Date.now() + data.resetIn * 1000);
        }
        throw new Error(data.error || "Failed to get response");
      }

      if (data.rateLimit) {
        setRemaining(data.rateLimit.remaining);
        // Sync window end time from server on every response (authoritative source of truth)
        if (data.rateLimit.resetIn > 0) {
          setWindowEndAt(Date.now() + data.rateLimit.resetIn * 1000);
        }
        if (data.rateLimit.remaining === 0) {
          setIsRateLimited(true);
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (sessionId) saveMessage(sessionId, "assistant", data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] sm:h-[calc(100vh-4.5rem)] overflow-hidden rounded-xl border bg-white shadow-sm">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r bg-muted/30 transition-all duration-300 shrink-0",
          sidebarOpen
            ? "w-64 fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto rounded-l-xl"
            : "w-0 overflow-hidden border-r-0"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b shrink-0">
          <span className="text-sm font-semibold text-foreground pl-1">NESTAi</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={startNewChat}
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
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
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group relative flex items-center gap-1 rounded-lg transition-colors cursor-pointer",
                    currentSessionId === session.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-1 w-full px-2 py-1.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 text-xs bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
                        autoFocus
                        placeholder="Chat title"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") updateSessionTitle(session.id, editTitle);
                          else if (e.key === "Escape") setEditingSessionId(null);
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Save title"
                        onClick={() => updateSessionTitle(session.id, editTitle)}
                        className="p-1 rounded hover:bg-green-100 text-green-600"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel edit"
                        onClick={() => setEditingSessionId(null)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex-1 text-left px-2 py-2 min-w-0"
                        onClick={() => loadSession(session.id)}
                      >
                        <p className="text-xs font-medium truncate leading-tight">{session.title}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {formatRelativeDate(session.updated_at)}
                        </p>
                      </button>

                      {/* Context menu */}
                      <div className="relative pr-1 shrink-0">
                        <button
                          type="button"
                          aria-label="Session options"
                          className={cn(
                            "p-1 rounded hover:bg-muted transition-opacity text-muted-foreground",
                            menuOpenId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === session.id ? null : session.id);
                          }}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {menuOpenId === session.id && (
                          <div
                            className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-30 min-w-[130px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted flex items-center gap-2 transition-colors"
                              onClick={() => {
                                setEditTitle(session.title);
                                setEditingSessionId(session.id);
                                setMenuOpenId(null);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              Rename
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 flex items-center gap-2 text-destructive transition-colors"
                              onClick={() => deleteSession(session.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold">NESTAi</span>
              <span className="hidden sm:inline text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                Job search assistant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Real-time rate-limit counter */}
            <RateLimitCounter
              remaining={remaining}
              max={MAX_REQUESTS}
              resetCountdown={resetCountdown}
              isRateLimited={isRateLimited}
            />
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewChat}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* ── Empty / welcome state ── */
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
            /* ── Conversation ── */
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    /* User bubble — right-aligned */
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-muted rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant — left-aligned, no bubble */
                    <div className="flex gap-3 group">
                      <AssistantAvatar />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                          {msg.content}
                        </p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <CopyButton text={msg.content} />
                          <span className="text-[11px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
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
              /* ── Rate-limited: show a prominent countdown instead of the input ── */
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4">
                {/* Progress bar — drains left to right over the 60s window */}
                <div className="h-1 w-full rounded-full bg-destructive/15 mb-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive/40 transition-all duration-1000 [width:var(--bar-w)]"
                    style={{ "--bar-w": `${Math.max(0, (resetCountdown / (WINDOW_MS / 1000)) * 100)}%` } as React.CSSProperties}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-destructive">Rate limit reached</p>
                      <p className="text-xs text-destructive/70">You've used all {MAX_REQUESTS} requests for this minute</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold tabular-nums text-destructive leading-none">{resetCountdown}s</p>
                    <p className="text-[11px] text-destructive/60 mt-0.5">until reset</p>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Normal input ── */
              <form onSubmit={handleSubmit}>
                <div className="relative flex items-end gap-2 rounded-2xl border bg-background shadow-sm focus-within:shadow-md focus-within:border-border/80 transition-all px-3 py-2">
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
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading}
                    className={cn(
                      "h-8 w-8 rounded-xl shrink-0 transition-all",
                      input.trim() && !isLoading
                        ? "bg-primary hover:bg-primary/90"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </form>
            )}

            {/* Footer: always show reset countdown while window is active */}
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
  );
}
