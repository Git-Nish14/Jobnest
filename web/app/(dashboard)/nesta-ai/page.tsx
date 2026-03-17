"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  User,
  Loader2,
  Trash2,
  Zap,
  MessageSquare,
  Plus,
  History,
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
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

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

const SUGGESTED_QUESTIONS = [
  {
    icon: TrendingUp,
    title: "Application Stats",
    question: "How many applications have I submitted this month?",
  },
  {
    icon: Target,
    title: "Success Rate",
    question: "What's my application success rate?",
  },
  {
    icon: Building2,
    title: "Pending Responses",
    question: "Which companies haven't responded yet?",
  },
  {
    icon: Calendar,
    title: "Upcoming Interviews",
    question: "Do I have any upcoming interviews?",
  },
  {
    icon: Bell,
    title: "My Reminders",
    question: "What are my pending reminders?",
  },
  {
    icon: BrainCircuit,
    title: "Progress Summary",
    question: "Summarize my job search progress",
  },
];

export default function NestAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat history state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (rateLimitReset && rateLimitReset > 0) {
      const timer = setInterval(() => {
        setRateLimitReset((prev) => {
          if (prev && prev > 1) return prev - 1;
          setError(null);
          return null;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitReset]);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    if (menuOpenId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenId]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await fetch("/api/nesta-ai/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const createSession = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/nesta-ai/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (response.ok) {
        const data = await response.json();
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
      const response = await fetch(`/api/nesta-ai/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
        setMessages(loadedMessages);
        setCurrentSessionId(sessionId);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/nesta-ai/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (response.ok) {
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
      const response = await fetch(`/api/nesta-ai/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      }
    } catch (err) {
      console.error("Failed to update session title:", err);
    }
    setEditingSessionId(null);
  };

  const saveMessage = async (sessionId: string, role: "user" | "assistant", content: string) => {
    try {
      await fetch(`/api/nesta-ai/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent, questionOverride?: string) => {
    e?.preventDefault();
    const question = questionOverride || input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      if (sessionId) {
        setCurrentSessionId(sessionId);
        const title = question.slice(0, 50) + (question.length > 50 ? "..." : "");
        updateSessionTitle(sessionId, title);
      }
    }

    if (sessionId) {
      saveMessage(sessionId, "user", question);
    }

    try {
      const response = await fetch("/api/nesta-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && data.resetIn) {
          setRateLimitReset(data.resetIn);
        }
        throw new Error(data.error || "Failed to get response");
      }

      if (data.rateLimit) {
        setRemainingRequests(data.rateLimit.remaining);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (sessionId) {
        saveMessage(sessionId, "assistant", data.answer);
      }
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

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-0">
      {/* Chat History Sidebar */}
      <div
        className={cn(
          "bg-gradient-to-b from-muted/30 to-muted/10 border-r flex flex-col transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <History className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">Chat History</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="w-full gap-2 bg-primary hover:bg-primary/90 shadow-sm"
            onClick={startNewChat}
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
              <span className="text-xs text-muted-foreground">Loading history...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Start chatting to save history</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                  currentSessionId === session.id
                    ? "bg-primary/10 border border-primary/20 shadow-sm"
                    : "hover:bg-muted/60 border border-transparent"
                )}
              >
                {editingSessionId === session.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 text-sm bg-background border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                      aria-label="Chat session title"
                      placeholder="Enter title"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateSessionTitle(session.id, editTitle);
                        else if (e.key === "Escape") setEditingSessionId(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                      onClick={() => updateSessionTitle(session.id, editTitle)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-muted"
                      onClick={() => setEditingSessionId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        "p-2 rounded-lg shrink-0",
                        currentSessionId === session.id ? "bg-primary/20" : "bg-muted"
                      )}
                    >
                      <MessageSquare className={cn(
                        "h-4 w-4",
                        currentSessionId === session.id ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <button
                      type="button"
                      className="flex-1 text-left min-w-0"
                      onClick={() => loadSession(session.id)}
                    >
                      <p className="text-sm font-medium truncate leading-tight">{session.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeDate(session.updated_at)}
                      </p>
                    </button>
                    <div className="relative shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 transition-opacity",
                          menuOpenId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === session.id ? null : session.id);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      {menuOpenId === session.id && (
                        <div
                          className="absolute right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg py-1.5 z-20 min-w-[140px] animate-in fade-in-0 zoom-in-95"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2.5 transition-colors"
                            onClick={() => {
                              setEditTitle(session.title);
                              setEditingSessionId(session.id);
                              setMenuOpenId(null);
                            }}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                            Rename
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-2.5 text-destructive transition-colors"
                            onClick={() => deleteSession(session.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-muted"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">NESTAi Assistant</h1>
                <p className="text-xs text-muted-foreground">Your job search companion</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {remainingRequests !== null && (
              <div className="hidden sm:flex items-center gap-2 text-xs bg-muted/60 px-3 py-1.5 rounded-full">
                <div className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium">{remainingRequests}</span>
                </div>
                <span className="text-muted-foreground">requests left</span>
              </div>
            )}
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={startNewChat}
                className="gap-2 rounded-full px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Chat</span>
              </Button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <div className="max-w-2xl w-full">
                {/* Welcome Hero */}
                <div className="text-center mb-10">
                  <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/30">
                      <BrainCircuit className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    I can analyze your job applications, track your progress, and provide personalized insights.
                  </p>
                </div>

                {/* Suggested Questions Grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {SUGGESTED_QUESTIONS.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSubmit(undefined, item.question)}
                      className="group relative flex flex-col items-start p-4 rounded-2xl border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 text-left"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium mb-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.question}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-4",
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      message.role === "user"
                        ? "bg-gradient-to-br from-slate-700 to-slate-800"
                        : "bg-gradient-to-br from-primary to-primary/70"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                      message.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground"
                        : "bg-card border"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className={cn(
                      "text-[10px] mt-2 font-medium",
                      message.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                    )}>
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-sm text-muted-foreground">Analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-2">
            <div className="max-w-3xl mx-auto">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
                <span>{error}</span>
                {rateLimitReset && (
                  <span className="font-mono text-xs bg-destructive/20 px-2.5 py-1 rounded-full">
                    {rateLimitReset}s
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t bg-background/80 backdrop-blur-sm px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative flex items-end gap-3 p-2 rounded-2xl border bg-card shadow-lg shadow-black/5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your job applications..."
                  className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm focus:outline-none min-h-[44px] max-h-[120px] placeholder:text-muted-foreground/60"
                  rows={1}
                  disabled={isLoading || !!rateLimitReset}
                />
                <Button
                  type="submit"
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-xl shrink-0 transition-all duration-200",
                    input.trim() && !isLoading
                      ? "bg-primary hover:bg-primary/90 shadow-md shadow-primary/30"
                      : "bg-muted text-muted-foreground"
                  )}
                  disabled={!input.trim() || isLoading || !!rateLimitReset}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              5 questions per minute limit • Responses are AI-generated based on your data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
