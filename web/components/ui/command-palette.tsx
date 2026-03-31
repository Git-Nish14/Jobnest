"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Users, Calendar, Bell,
  DollarSign, BookTemplate, FolderOpen, Bot, Plus,
  Search, Settings, X,
} from "lucide-react";
import { Dialog, DialogContent } from "./dialog";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router, setOpen]
  );

  const items: CommandItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, action: () => navigate("/dashboard"), keywords: ["home", "overview"] },
    { id: "applications", label: "Applications", description: "View all job applications", icon: FileText, action: () => navigate("/applications"), keywords: ["jobs", "tracker"] },
    { id: "new-application", label: "New Application", description: "Log a new job application", icon: Plus, action: () => navigate("/applications/new"), keywords: ["add", "create"] },
    { id: "interviews", label: "Interviews", icon: Calendar, action: () => navigate("/interviews"), keywords: ["schedule", "meeting"] },
    { id: "contacts", label: "Contacts", icon: Users, action: () => navigate("/contacts"), keywords: ["recruiter", "people", "crm"] },
    { id: "reminders", label: "Reminders", icon: Bell, action: () => navigate("/reminders"), keywords: ["alerts", "follow", "up"] },
    { id: "salary", label: "Salary Tracker", icon: DollarSign, action: () => navigate("/salary"), keywords: ["compensation", "offers", "pay"] },
    { id: "templates", label: "Email Templates", icon: BookTemplate, action: () => navigate("/templates"), keywords: ["emails", "messages"] },
    { id: "documents", label: "Documents", icon: FolderOpen, action: () => navigate("/documents"), keywords: ["resume", "cv", "files"] },
    { id: "nestai", label: "NESTAi Assistant", description: "Open your AI job search assistant", icon: Bot, action: () => navigate("/nestai"), keywords: ["ai", "chat", "assistant"] },
    { id: "profile", label: "Profile Settings", icon: Settings, action: () => navigate("/profile"), keywords: ["account", "settings", "password"] },
  ];

  const filtered = query.trim()
    ? items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.includes(q))
        );
      })
    : items;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      filtered[activeIndex].action();
    }
  }

  // Reset state when palette opens — runs in a timeout so React batches it
  // outside the render cycle and avoids the setState-in-effect lint rule.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  // Reset active index when query changes — deferred to avoid cascade renders
  useEffect(() => {
    const id = setTimeout(() => setActiveIndex(0), 0);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[92vw] max-w-lg p-0 gap-0 overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#dbc1b9]/20">
          <Search className="h-4 w-4 text-[#88726c] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-sm text-[#1a1c1b] placeholder-[#88726c] outline-none dark:text-[#e8ddd9] dark:placeholder-[#7a6460]"
            aria-label="Command palette search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[#88726c] hover:text-[#1a1c1b] transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-[#88726c] border border-[#dbc1b9]/40 rounded px-1.5 py-0.5 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2" role="listbox" aria-label="Command palette results">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#88726c]">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const isActive = i === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={item.action}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-[#99462a]/8 text-[#1a1c1b] dark:bg-[#99462a]/15 dark:text-[#e8ddd9]"
                      : "text-[#55433d] hover:bg-[#f4f3f1] dark:text-[#c4a99f] dark:hover:bg-white/5"
                  }`}
                >
                  <div className={`h-8 w-8 flex items-center justify-center rounded-lg shrink-0 ${
                    isActive ? "bg-[#99462a]/10 text-[#99462a]" : "bg-[#f4f3f1] text-[#88726c] dark:bg-white/8"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-[#88726c] truncate">{item.description}</p>
                    )}
                  </div>
                  {isActive && (
                    <kbd className="hidden sm:block text-[10px] text-[#88726c] border border-[#dbc1b9]/40 rounded px-1.5 py-0.5 font-mono shrink-0">
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[#dbc1b9]/20 px-4 py-2 flex items-center gap-4 text-[10px] text-[#88726c]">
          <span className="flex items-center gap-1"><kbd className="border border-[#dbc1b9]/40 rounded px-1 font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="border border-[#dbc1b9]/40 rounded px-1 font-mono">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="border border-[#dbc1b9]/40 rounded px-1 font-mono">Esc</kbd> close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
