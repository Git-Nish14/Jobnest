"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star, GitFork, RefreshCw, Loader2, Trash2, ExternalLink,
  MapPin, Building2, Globe, Users, BookOpen, Pin, PinOff, AlertCircle,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/brand-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

interface GitHubConnection {
  github_username: string;
  github_name: string | null;
  github_avatar_url: string | null;
  github_bio: string | null;
  github_location: string | null;
  github_company: string | null;
  github_blog: string | null;
  github_public_repos: number;
  github_followers: number;
  github_following: number;
  last_synced_at: string | null;
}

interface GitHubRepo {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage_url: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  is_fork: boolean;
  is_archived: boolean;
  topics: string[];
  is_pinned: boolean;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500", JavaScript: "bg-yellow-400", Python: "bg-blue-600",
  Go: "bg-cyan-500", Rust: "bg-orange-600", Java: "bg-red-600",
  "C++": "bg-pink-600", C: "bg-gray-600", "C#": "bg-purple-600",
  Swift: "bg-orange-500", Kotlin: "bg-purple-500", Ruby: "bg-red-500",
  PHP: "bg-indigo-500", Dart: "bg-teal-500", HTML: "bg-orange-400",
  CSS: "bg-blue-400", Shell: "bg-green-600", Vue: "bg-emerald-500",
};

function LanguageDot({ lang }: { lang: string | null }) {
  if (!lang) return null;
  const color = LANG_COLORS[lang] ?? "bg-zinc-400";
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {lang}
    </span>
  );
}

export function GitHubSection() {
  const searchParams = useSearchParams();
  const [conn, setConn] = useState<GitHubConnection | null | undefined>(undefined);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchData = useCallback(async () => {
    const [connRes, reposRes] = await Promise.all([
      fetch("/api/portfolio/github/connection"),
      fetch("/api/portfolio/github/repos"),
    ]);
    if (connRes.ok) {
      const d = await connRes.json() as { connection: GitHubConnection | null };
      setConn(d.connection);
    } else {
      setConn(null);
    }
    if (reposRes.ok) {
      const d = await reposRes.json() as { repos: GitHubRepo[] };
      setRepos(d.repos);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [connRes, reposRes] = await Promise.all([
        fetch("/api/portfolio/github/connection"),
        fetch("/api/portfolio/github/repos"),
      ]);
      if (cancelled) return;
      if (connRes.ok) {
        const d = await connRes.json() as { connection: GitHubConnection | null };
        setConn(d.connection);
      } else {
        setConn(null);
      }
      if (reposRes.ok) {
        const d = await reposRes.json() as { repos: GitHubRepo[] };
        setRepos(d.repos);
      }
    };
    void run();

    // Show toast if redirected back after OAuth
    const ghConnected = searchParams.get("github_connected");
    const ghError = searchParams.get("github_error");
    if (ghConnected === "1") toast.success("GitHub connected!");
    if (ghError) toast.error(`GitHub error: ${ghError.replace(/_/g, " ")}`);

    return () => { cancelled = true; };
  }, [searchParams]);

  const sync = async () => {
    setSyncing(true);
    const res = await fetch("/api/portfolio/github/sync", { method: "POST" });
    setSyncing(false);
    if (res.ok) {
      toast.success("GitHub synced.");
      void fetchData();
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Sync failed.");
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect GitHub? This removes all cached repos from Jobnest.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/portfolio/github/disconnect", { method: "DELETE" });
    setDisconnecting(false);
    if (res.ok) {
      setConn(null);
      setRepos([]);
      toast.success("GitHub disconnected.");
    } else {
      toast.error("Failed to disconnect.");
    }
  };

  const togglePin = async (repo: GitHubRepo) => {
    const newPinned = !repo.is_pinned;
    setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, is_pinned: newPinned } : r)));
    const res = await fetch("/api/portfolio/github/repos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, is_pinned: newPinned }),
    });
    if (!res.ok) {
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, is_pinned: repo.is_pinned } : r)));
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Failed to update pin.");
    }
  };

  if (conn === undefined) {
    return (
      <div className="db-content-card flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading GitHub…
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="db-content-card space-y-4">
        <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
          <GithubIcon className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> GitHub Integration
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect your GitHub account to showcase your repos and contributions on your public portfolio.
        </p>
        <a
          href="/api/portfolio/github/connect"
          className="inline-flex items-center gap-2 rounded-lg bg-[#24292e] dark:bg-zinc-800 text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <GithubIcon className="h-4 w-4" /> Connect GitHub
        </a>
      </div>
    );
  }

  const pinnedCount = repos.filter((r) => r.is_pinned).length;

  return (
    <div className="db-content-card space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
          <GithubIcon className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> GitHub
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={disconnecting}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Disconnect
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="flex items-start gap-4 rounded-xl border border-border bg-muted/20 px-4 py-4">
        {conn.github_avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conn.github_avatar_url}
            alt={conn.github_username}
            className="h-14 w-14 rounded-full border border-border shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              {conn.github_name ?? conn.github_username}
            </p>
            <a
              href={`https://github.com/${conn.github_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              @{conn.github_username} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {conn.github_bio && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{conn.github_bio}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {conn.github_location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {conn.github_location}
              </span>
            )}
            {conn.github_company && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> {conn.github_company}
              </span>
            )}
            {conn.github_blog && (
              <a
                href={conn.github_blog.startsWith("http") ? conn.github_blog : `https://${conn.github_blog}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-3 w-3" /> Website
              </a>
            )}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <strong className="text-foreground">{conn.github_followers.toLocaleString()}</strong> followers
            </span>
            <span className="text-xs text-muted-foreground">
              <strong className="text-foreground">{conn.github_following.toLocaleString()}</strong> following
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <strong className="text-foreground">{conn.github_public_repos}</strong> repos
            </span>
          </div>
        </div>
      </div>

      {/* Repos */}
      {repos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Repositories
            </p>
            <p className="text-xs text-muted-foreground">
              {pinnedCount}/6 pinned for portfolio
            </p>
          </div>

          {pinnedCount === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Pin up to 6 repos to feature them on your public portfolio.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[28rem] overflow-y-auto pr-1">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className={cn(
                  "relative rounded-xl border px-4 py-3 space-y-2 transition-colors",
                  repo.is_pinned
                    ? "border-[#99462a]/40 dark:border-[#ccff00]/30 bg-[#99462a]/5 dark:bg-[#ccff00]/5"
                    : "border-border bg-background hover:bg-muted/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-foreground hover:underline truncate block"
                    >
                      {repo.name}
                    </a>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {repo.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void togglePin(repo)}
                    disabled={!repo.is_pinned && pinnedCount >= 6}
                    title={repo.is_pinned ? "Unpin from portfolio" : "Pin to portfolio"}
                    className={cn(
                      "shrink-0 h-6 w-6 flex items-center justify-center rounded-md transition-colors",
                      repo.is_pinned
                        ? "text-[#99462a] dark:text-[#ccff00] hover:bg-[#99462a]/10 dark:hover:bg-[#ccff00]/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30"
                    )}
                  >
                    {repo.is_pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <LanguageDot lang={repo.language} />
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" /> {repo.stargazers_count}
                    </span>
                  )}
                  {repo.forks_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <GitFork className="h-3 w-3" /> {repo.forks_count}
                    </span>
                  )}
                  {repo.is_archived && (
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      Archived
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {conn.last_synced_at && (
            <p className="text-[10px] text-muted-foreground text-right">
              Last synced {new Date(conn.last_synced_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
