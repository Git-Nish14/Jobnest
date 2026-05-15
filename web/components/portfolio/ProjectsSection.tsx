"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Loader2, Pencil, X, Check, ExternalLink,
  Star, FolderKanban, ArrowUp, ArrowDown, ImageIcon,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/brand-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GHRepo {
  id: string;
  name: string;
  html_url: string;
  language: string | null;
  stargazers_count: number;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  demo_url: string | null;
  repo_url: string | null;
  image_url: string | null;
  github_repo_id: string | null;
  is_featured: boolean;
  display_order: number;
  github_repo?: { name: string; html_url: string; language: string | null; stargazers_count: number } | null;
}

const EMPTY_FORM = {
  title: "", description: "", tags: "", demo_url: "", repo_url: "",
  image_url: "", github_repo_id: "", is_featured: false,
};

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.slice(0, 5).map((t) => (
        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground">
          {t}
        </span>
      ))}
      {tags.length > 5 && (
        <span className="text-[10px] text-muted-foreground">+{tags.length - 5}</span>
      )}
    </div>
  );
}

export function ProjectsSection() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/portfolio/projects").then((r) => r.ok ? r.json() as Promise<{ projects: Project[] }> : null),
      fetch("/api/portfolio/github/repos").then((r) => r.ok ? r.json() as Promise<{ repos: GHRepo[] }> : null),
    ]).then(([p, r]) => {
      if (cancelled) return;
      if (p) setProjects(p.projects);
      if (r) setRepos(r.repos);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      demo_url: form.demo_url.trim() || null,
      repo_url: form.repo_url.trim() || null,
      image_url: form.image_url.trim() || null,
      github_repo_id: form.github_repo_id || null,
      is_featured: form.is_featured,
      display_order: editId
        ? (projects.find((p) => p.id === editId)?.display_order ?? 0)
        : projects.length,
    };

    const url = editId ? `/api/portfolio/projects/${editId}` : "/api/portfolio/projects";
    const method = editId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (res.ok) {
      const d = await res.json() as { project: Project };
      if (editId) {
        setProjects((prev) => prev.map((p) => (p.id === editId ? d.project : p)));
        toast.success("Project updated.");
      } else {
        setProjects((prev) => [...prev, d.project]);
        toast.success("Project added.");
      }
      setForm(EMPTY_FORM);
      setAdding(false);
      setEditId(null);
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? "Failed to save project.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/portfolio/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted.");
    } else {
      toast.error("Failed to delete project.");
    }
  };

  const moveOrder = async (id: string, dir: "up" | "down") => {
    const idx = projects.findIndex((p) => p.id === id);
    if ((dir === "up" && idx === 0) || (dir === "down" && idx === projects.length - 1)) return;
    const prev = [...projects];
    const next = [...projects];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const partnerId = next[dir === "up" ? idx : swapIdx].id;

    // Optimistic update
    setProjects(next.map((p, i) => ({ ...p, display_order: i })));

    const [r1, r2] = await Promise.all([
      fetch(`/api/portfolio/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: swapIdx }),
      }),
      fetch(`/api/portfolio/projects/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: idx }),
      }),
    ]);

    if (!r1.ok || !r2.ok) {
      // Roll back optimistic update if either write failed
      setProjects(prev);
      toast.error("Failed to reorder projects.");
    }
  };

  const startEdit = (p: Project) => {
    setEditId(p.id);
    setForm({
      title: p.title,
      description: p.description ?? "",
      tags: p.tags.join(", "),
      demo_url: p.demo_url ?? "",
      repo_url: p.repo_url ?? "",
      image_url: p.image_url ?? "",
      github_repo_id: p.github_repo_id ?? "",
      is_featured: p.is_featured,
    });
    setAdding(true);
  };

  const cancelEdit = () => {
    setEditId(null);
    setAdding(false);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="db-content-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="db-headline text-lg font-semibold text-foreground flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-[#99462a] dark:text-[#ccff00]" /> Projects
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" /> Add project
          </button>
        )}
      </div>

      {/* Form */}
      {adding && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">
            {editId ? "Edit project" : "New project"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              placeholder="Project title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#99462a]"
            />
            <input
              placeholder="Demo URL (https://...)"
              value={form.demo_url}
              onChange={(e) => setForm((f) => ({ ...f, demo_url: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]"
            />
            <input
              placeholder="Repo URL (https://...)"
              value={form.repo_url}
              onChange={(e) => setForm((f) => ({ ...f, repo_url: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]"
            />
            <input
              placeholder="Tags (comma-separated)"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]"
            />
            <div className="sm:col-span-2 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                placeholder="Image URL (https://…) — optional cover image"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]"
              />
              {form.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="h-10 w-16 rounded object-cover border border-border shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
            {repos.length > 0 && (
              <select
                aria-label="Link GitHub repo"
                value={form.github_repo_id}
                onChange={(e) => setForm((f) => ({ ...f, github_repo_id: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#99462a]"
              >
                <option value="">Link a GitHub repo (optional)</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm col-span-full">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                className="accent-[#99462a]"
              />
              Feature on portfolio
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !form.title.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {editId ? "Save changes" : "Add project"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : projects.length === 0 ? (
        <p className="text-xs text-muted-foreground">No projects yet. Add your first project above.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3",
                p.is_featured
                  ? "border-[#99462a]/40 dark:border-[#ccff00]/30 bg-[#99462a]/5 dark:bg-[#ccff00]/5"
                  : "border-border"
              )}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => void moveOrder(p.id, "up")}
                  disabled={idx === 0}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveOrder(p.id, "down")}
                  disabled={idx === projects.length - 1}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.title}
                  className="h-14 w-20 rounded-lg object-cover border border-border shrink-0 hidden sm:block"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  {p.is_featured && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00]">
                      Featured
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                )}
                <TagList tags={p.tags} />
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {p.demo_url && (
                    <a href={p.demo_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#99462a] dark:text-[#ccff00] hover:underline">
                      <ExternalLink className="h-3 w-3" /> Demo
                    </a>
                  )}
                  {p.repo_url && (
                    <a href={p.repo_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <GithubIcon className="h-3 w-3" /> Repo
                    </a>
                  )}
                  {p.github_repo && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" /> {p.github_repo.stargazers_count}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label={`Edit ${p.title}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Delete ${p.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
