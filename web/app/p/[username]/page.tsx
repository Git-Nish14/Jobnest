import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Star, GitFork, ExternalLink, MapPin, Building2,
  Globe, Users, Mail, BookOpen,
} from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/ui/brand-icons";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicPortfolio {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  aboutMe: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  linkedinUrl: string | null;
  email: string | null;
  github: {
    username: string;
    name: string | null;
    followers: number;
    following: number;
    publicRepos: number;
    company: string | null;
    location: string | null;
    blog: string | null;
  } | null;
  pinnedRepos: {
    id: string;
    name: string;
    description: string | null;
    html_url: string;
    homepage_url: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    topics: string[];
  }[];
  projects: {
    id: string;
    title: string;
    description: string | null;
    tags: string[];
    demo_url: string | null;
    repo_url: string | null;
    is_featured: boolean;
    display_order: number;
  }[];
  skills: {
    id: string;
    name: string;
    category: string;
    proficiency: string;
  }[];
  certifications: {
    id: string;
    name: string;
    provider: string | null;
    issued_at: string;
    expires_at: string | null;
  }[];
  education: {
    id: string;
    institution: string;
    degree: string;
    field_of_study: string | null;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    gpa: number | null;
    show_gpa: boolean;
  }[];
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const portfolio = await fetchPortfolio(username);
  if (!portfolio) return { title: "Portfolio not found" };

  const name = portfolio.displayName || portfolio.username;
  return {
    title: `${name} — Portfolio`,
    description: portfolio.bio ?? portfolio.aboutMe ?? `${name}'s developer portfolio on Jobnest`,
    openGraph: {
      title: `${name} — Portfolio`,
      description: portfolio.bio ?? portfolio.aboutMe ?? undefined,
      images: portfolio.avatarUrl ? [{ url: portfolio.avatarUrl }] : undefined,
      type: "profile",
    },
    twitter: { card: "summary", title: `${name} — Portfolio` },
  };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchPortfolio(username: string): Promise<PublicPortfolio | null> {
  const admin = createAdminClient();

  // Look up user_id from usernames table
  const { data: uRow } = await admin
    .from("usernames")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (!uRow) return null;
  const userId = uRow.user_id;

  // Check portfolio_public flag in user_metadata via admin.auth
  const { data: { user }, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !user) return null;

  const meta = user.user_metadata ?? {};
  if (!meta.portfolio_public) return null;

  // Fetch all portfolio data in parallel
  const [connRes, reposRes, projectsRes, skillsRes, certsRes, eduRes] = await Promise.all([
    admin.from("github_connections")
      .select("github_username, github_name, github_avatar_url, github_bio, github_location, github_company, github_blog, github_followers, github_following, github_public_repos")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("github_repos")
      .select("id, name, description, html_url, homepage_url, language, stargazers_count, forks_count, topics")
      .eq("user_id", userId)
      .eq("is_pinned", true)
      .order("stargazers_count", { ascending: false })
      .limit(6),
    admin.from("projects")
      .select("id, title, description, tags, demo_url, repo_url, is_featured, display_order")
      .eq("user_id", userId)
      .order("display_order"),
    admin.from("skills")
      .select("id, name, category, proficiency")
      .eq("user_id", userId)
      .order("category").order("name"),
    admin.from("certifications")
      .select("id, name, provider, issued_at, expires_at")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false }),
    admin.from("education")
      .select("id, institution, degree, field_of_study, start_date, end_date, is_current, gpa, show_gpa")
      .eq("user_id", userId)
      .order("start_date", { ascending: false }),
  ]);

  const ghConn = connRes.data;

  return {
    username,
    displayName: meta.display_name ?? meta.full_name ?? username,
    avatarUrl: ghConn?.github_avatar_url ?? null,
    bio: ghConn?.github_bio ?? null,
    aboutMe: meta.about_me ?? null,
    location: ghConn?.github_location ?? null,
    company: ghConn?.github_company ?? null,
    blog: ghConn?.github_blog ?? null,
    linkedinUrl: meta.linkedin_url ?? null,
    // Only expose email if the user has explicitly opted in via show_email flag
    email: meta.show_email === true ? (user.email ?? null) : null,
    github: ghConn
      ? {
          username: ghConn.github_username,
          name: ghConn.github_name,
          followers: ghConn.github_followers,
          following: ghConn.github_following,
          publicRepos: ghConn.github_public_repos,
          company: ghConn.github_company,
          location: ghConn.github_location,
          blog: ghConn.github_blog,
        }
      : null,
    pinnedRepos: reposRes.data ?? [],
    projects: projectsRes.data ?? [],
    skills: skillsRes.data ?? [],
    certifications: certsRes.data ?? [],
    education: eduRes.data ?? [],
  };
}

// ── Language colors ───────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
  Go: "#00ADD8", Rust: "#dea584", Java: "#b07219", "C++": "#f34b7d",
  C: "#555555", "C#": "#178600", Swift: "#FA7343", Kotlin: "#A97BFF",
  Ruby: "#701516", PHP: "#4F5D95", Dart: "#00B4AB", HTML: "#e34c26",
  CSS: "#563d7c", Shell: "#89e051", Vue: "#41b883",
};

// ── Skill proficiency color ───────────────────────────────────────────────────

const PROF_STYLE: Record<string, string> = {
  Beginner: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Advanced: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Expert: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const portfolio = await fetchPortfolio(username);

  if (!portfolio) notFound();

  const {
    displayName, avatarUrl, bio, aboutMe, location, company, blog,
    linkedinUrl, github, pinnedRepos, projects, skills, certifications, education,
  } = portfolio;

  const name = displayName || username;
  const featuredProjects = projects.filter((p) => p.is_featured);
  const otherProjects = projects.filter((p) => !p.is_featured);

  // Group skills by category
  const skillsByCategory = skills.reduce<Record<string, typeof skills>>((acc, s) => {
    (acc[s.category] = acc[s.category] ?? []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#99462a] dark:text-[#ccff00]">
            Jobnest
          </Link>
          <span className="text-xs text-muted-foreground">@{username}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
        {/* ── Profile hero ───────────────────────────────────────────────────── */}
        <section className="flex flex-col sm:flex-row items-start gap-6">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-24 w-24 rounded-full border-2 border-border shrink-0"
            />
          ) : (
            <div className="h-24 w-24 rounded-full border-2 border-border bg-[#99462a]/10 dark:bg-[#ccff00]/10 flex items-center justify-center shrink-0">
              <span className="text-3xl font-semibold text-[#99462a] dark:text-[#ccff00]">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-3xl font-bold text-foreground font-[var(--font-newsreader)]">{name}</h1>

            {bio && <p className="text-base text-muted-foreground max-w-xl">{bio}</p>}
            {!bio && aboutMe && <p className="text-base text-muted-foreground max-w-xl">{aboutMe}</p>}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {location}
                </span>
              )}
              {company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 shrink-0" /> {company}
                </span>
              )}
              {blog && (
                <a
                  href={blog.startsWith("http") ? blog : `https://${blog}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" /> Website
                </a>
              )}
              {github && (
                <a
                  href={`https://github.com/${github.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <GithubIcon className="h-3.5 w-3.5 shrink-0" /> {github.username}
                </a>
              )}
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <LinkedinIcon className="h-3.5 w-3.5 shrink-0" /> LinkedIn
                </a>
              )}
            </div>

            {/* GitHub stats pills */}
            {github && (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <strong className="text-foreground">{github.followers.toLocaleString()}</strong> followers
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
                  <BookOpen className="h-3 w-3" />
                  <strong className="text-foreground">{github.publicRepos}</strong> repos
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── Featured Projects ───────────────────────────────────────────────── */}
        {featuredProjects.length > 0 && (
          <Section title="Featured Projects">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featuredProjects.map((p) => (
                <ProjectCard key={p.id} project={p} featured />
              ))}
            </div>
          </Section>
        )}

        {/* ── Pinned Repos ────────────────────────────────────────────────────── */}
        {pinnedRepos.length > 0 && (
          <Section title="GitHub Repositories">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pinnedRepos.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-background hover:border-[#99462a]/40 dark:hover:border-[#ccff00]/30 p-4 space-y-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground group-hover:text-[#99462a] dark:group-hover:text-[#ccff00] transition-colors">
                      {repo.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {repo.language && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: LANG_COLORS[repo.language] ?? "#888" }}
                        />
                        {repo.language}
                      </span>
                    )}
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
                  </div>
                  {repo.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {repo.topics.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* ── Other Projects ──────────────────────────────────────────────────── */}
        {otherProjects.length > 0 && (
          <Section title="Projects">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {otherProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Skills ─────────────────────────────────────────────────────────── */}
        {skills.length > 0 && (
          <Section title="Skills">
            <div className="space-y-4">
              {Object.entries(skillsByCategory).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {cat}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-background pl-3 pr-2 py-1"
                      >
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PROF_STYLE[s.proficiency] ?? "bg-muted text-muted-foreground"}`}>
                          {s.proficiency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Education ──────────────────────────────────────────────────────── */}
        {education.length > 0 && (
          <Section title="Education">
            <div className="space-y-3">
              {education.map((e) => (
                <div key={e.id} className="flex items-start gap-4 rounded-xl border border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{e.institution}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.degree}{e.field_of_study ? ` · ${e.field_of_study}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(e.start_date).getFullYear()} –{" "}
                      {e.is_current ? "Present" : e.end_date ? new Date(e.end_date).getFullYear() : "—"}
                      {e.show_gpa && e.gpa != null && ` · GPA ${e.gpa.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Certifications ─────────────────────────────────────────────────── */}
        {certifications.length > 0 && (
          <Section title="Certifications">
            <div className="space-y-3">
              {certifications.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    {c.provider && <p className="text-xs text-muted-foreground">{c.provider}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Issued {new Date(c.issued_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      {c.expires_at && (
                        <> · Expires {new Date(c.expires_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── CTA ────────────────────────────────────────────────────────────── */}
        <section className="border-t border-border pt-10 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Portfolio powered by{" "}
            <Link href="/" className="font-semibold text-[#99462a] dark:text-[#ccff00] hover:underline">
              Jobnest
            </Link>
          </p>
          {portfolio.email && (
            <a
              href={`mailto:${portfolio.email}`}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-[#99462a] dark:bg-[#ccff00] text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Mail className="h-4 w-4" /> Contact {name.split(" ")[0]}
            </a>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold text-foreground font-[var(--font-newsreader)]">{title}</h2>
      {children}
    </section>
  );
}

function ProjectCard({
  project,
  featured,
}: {
  project: PublicPortfolio["projects"][0];
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 space-y-2 ${
        featured
          ? "border-[#99462a]/40 dark:border-[#ccff00]/30 bg-[#99462a]/5 dark:bg-[#ccff00]/5"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{project.title}</h3>
        {featured && (
          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#99462a]/10 dark:bg-[#ccff00]/10 text-[#99462a] dark:text-[#ccff00]">
            Featured
          </span>
        )}
      </div>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-3">{project.description}</p>
      )}
      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 5).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 pt-1">
        {project.demo_url && (
          <a
            href={project.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 flex items-center gap-1 text-xs text-[#99462a] dark:text-[#ccff00] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Demo
          </a>
        )}
        {project.repo_url && (
          <a
            href={project.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <GithubIcon className="h-3 w-3" /> Code
          </a>
        )}
      </div>
    </div>
  );
}
