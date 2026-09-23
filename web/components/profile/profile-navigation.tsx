"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { BriefcaseBusiness, Plug, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", description: "Your name, photo & bio", icon: User },
  { id: "career", label: "Career", description: "Goals, experience & portfolio", icon: BriefcaseBusiness },
  { id: "integrations", label: "Integrations", description: "ChatGPT & NESTAi", icon: Plug },
  { id: "account", label: "Account", description: "Notifications & security", icon: Shield },
] as const;

export type ProfileSection = (typeof SECTIONS)[number]["id"];

const SECTION_FOR_ANCHOR: Record<string, ProfileSection> = {
  profile: "profile", "display-name": "profile", about: "profile",
  career: "career", "work-authorization": "career", goals: "career",
  skills: "career", certifications: "career", education: "career",
  github: "career", projects: "career", linkedin: "career", portfolio: "career",
  integrations: "integrations", chatgpt: "integrations", nestai: "integrations",
  account: "account", notifications: "account", password: "account", danger: "account", referrals: "account",
};

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
}

function getAnchor() {
  const hash = window.location.hash.slice(1);
  if (hash) return hash;
  const params = new URLSearchParams(window.location.search);
  return params.has("github_connected") || params.has("github_error") ? "github" : "profile";
}

export function useProfileNavigation() {
  const anchor = useSyncExternalStore(subscribe, getAnchor, () => "profile");
  const section = SECTION_FOR_ANCHOR[anchor] ?? "profile";

  useEffect(() => {
    // Keep links from the dashboard and OAuth return screens working after
    // revealing the panel. Category switches leave the navigation in place.
    if (!SECTION_FOR_ANCHOR[anchor] || SECTIONS.some(({ id }) => id === anchor)) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      const disclosure = target?.closest("details");
      if (disclosure) disclosure.open = true;
      target?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor]);

  return { section, anchor };
}

export function ProfileNavigation({ section }: { section: ProfileSection }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const next = SECTIONS[index].id;
    if (window.location.hash !== `#${next}`) {
      window.history.pushState(window.history.state, "", `#${next}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  return (
    <div role="tablist" aria-label="Profile settings" className="grid grid-cols-4 gap-1 rounded-2xl border bg-muted/50 p-1.5">
      {SECTIONS.map(({ id, label, description, icon: Icon }, index) => (
        <button
          key={id}
          ref={(el) => { refs.current[index] = el; }}
          type="button"
          role="tab"
          id={`profile-tab-${id}`}
          aria-controls={`profile-panel-${id}`}
          aria-selected={section === id}
          tabIndex={section === id ? 0 : -1}
          onClick={() => select(index)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % SECTIONS.length;
            else if (event.key === "ArrowLeft") next = (index + SECTIONS.length - 1) % SECTIONS.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = SECTIONS.length - 1;
            else return;
            event.preventDefault();
            select(next);
            refs.current[next]?.focus();
          }}
          className={cn(
            "min-w-0 rounded-xl px-1.5 py-3 text-center transition-colors sm:px-4 sm:text-left",
            section === id ? "bg-card text-primary shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
          )}
        >
          <span className="flex flex-col items-center gap-1.5 text-xs font-semibold sm:flex-row sm:gap-2 sm:text-sm">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}
          </span>
          <span className="mt-1 hidden text-xs text-muted-foreground lg:block">{description}</span>
        </button>
      ))}
    </div>
  );
}

export function ProfilePanel({ id, active, title, description, children }: {
  id: ProfileSection; active: ProfileSection; title: string; description: string; children: ReactNode;
}) {
  return (
    <section id={`profile-panel-${id}`} role="tabpanel" aria-labelledby={`profile-tab-${id}`} hidden={active !== id} tabIndex={0} className="space-y-5 focus-visible:rounded-xl">
      <div className="pt-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
