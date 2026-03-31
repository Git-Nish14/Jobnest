"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, Loader2, Briefcase, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  user: { email: string; displayName: string };
}

const STEPS = [
  { id: 1, title: "Welcome", icon: User },
  { id: 2, title: "Applications", icon: Briefcase },
  { id: 3, title: "NESTAi", icon: Bot },
] as const;

export function OnboardingWizard({ user }: Props) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [aboutMe, setAboutMe] = useState("");
  const [loading, setLoading] = useState(false);

  const isLast = step === STEPS.length;

  // Calls the API to save data (if any) and mark onboarding complete,
  // then redirects to dashboard. Used for both "Finish" and "Skip".
  async function finish(saveData: boolean) {
    setLoading(true);
    try {
      const body = saveData
        ? { displayName: displayName.trim(), aboutMe: aboutMe.trim() }
        : {}; // skip → send nothing, profile will be blank

      const res = await fetch("/api/profile/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Request failed");
      }

      // Hard redirect — forces a full HTTP round-trip so the proxy's getUser()
      // call sees onboarding_completed: true before the dashboard renders.
      // router.push() alone can race with a stale RSC cache.
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg + " — please try again.");
      setLoading(false);
    }
  }

  function handleNext() {
    if (isLast) {
      finish(true);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    finish(false);
  }

  return (
    <div>
      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map(({ id }) => (
          <div key={id} className="flex items-center gap-2 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all shrink-0 ${
                id < step
                  ? "bg-[#99462a] text-white"
                  : id === step
                  ? "bg-[#99462a]/12 text-[#99462a] ring-2 ring-[#99462a]/30"
                  : "bg-[#e9e8e6] text-[#88726c]"
              }`}
            >
              {id < step ? <CheckCircle2 className="h-4 w-4" /> : id}
            </div>
            {id < STEPS.length && (
              <div
                className={`flex-1 h-px transition-colors ${
                  id < step ? "bg-[#99462a]" : "bg-[#dbc1b9]/30"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-[#dbc1b9]/20 shadow-sm p-7 sm:p-8">
        {step === 1 && (
          <StepWelcome
            email={user.email}
            displayName={displayName}
            setDisplayName={setDisplayName}
            aboutMe={aboutMe}
            setAboutMe={setAboutMe}
          />
        )}
        {step === 2 && <StepApplications />}
        {step === 3 && <StepNestAi />}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#dbc1b9]/15">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-sm text-[#88726c] hover:text-[#55433d] transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>

          <Button
            onClick={handleNext}
            disabled={loading}
            className="gap-2 min-w-[130px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLast ? (
              <>Finish <CheckCircle2 className="h-4 w-4" /></>
            ) : (
              <>Next <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-[#88726c] mt-4">
        You can update everything later in your profile settings.
      </p>
    </div>
  );
}

// ── Step 1: Welcome + name/about ─────────────────────────────────────────────

function StepWelcome({
  email,
  displayName,
  setDisplayName,
  aboutMe,
  setAboutMe,
}: {
  email: string;
  displayName: string;
  setDisplayName: (v: string) => void;
  aboutMe: string;
  setAboutMe: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-xl bg-[#99462a]/10 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-[#99462a]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1a1c1b]">Welcome to Jobnest</h1>
          <p className="text-sm text-[#88726c]">{email}</p>
        </div>
      </div>

      <p className="text-sm text-[#55433d] mb-5 leading-relaxed">
        Set up your profile in under a minute. Both fields are optional — skip anything you like.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-semibold text-[#55433d] mb-1.5">
            Your name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Nish Patel"
            maxLength={64}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbc1b9]/50 bg-[#f4f3f1] text-sm text-[#1a1c1b] placeholder-[#88726c] outline-none focus:ring-2 focus:ring-[#99462a]/30"
          />
        </div>

        <div>
          <label htmlFor="aboutMe" className="block text-sm font-semibold text-[#55433d] mb-1">
            About you
            <span className="ml-1.5 font-normal text-[#88726c]">
              — NESTAi uses this to personalise answers
            </span>
          </label>
          <textarea
            id="aboutMe"
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            placeholder="e.g. Software engineer with 3 years of experience, targeting senior roles at product companies in NYC."
            maxLength={2000}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbc1b9]/50 bg-[#f4f3f1] text-sm text-[#1a1c1b] placeholder-[#88726c] outline-none focus:ring-2 focus:ring-[#99462a]/30 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Applications overview ────────────────────────────────────────────

function StepApplications() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-xl bg-[#99462a]/10 flex items-center justify-center shrink-0">
          <Briefcase className="h-5 w-5 text-[#99462a]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1a1c1b]">Track your applications</h2>
          <p className="text-sm text-[#88726c]">Everything in one place</p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { emoji: "📋", title: "Log every application", desc: "Company, position, status, salary, notes — all in one place." },
          { emoji: "📅", title: "Interviews & deadlines", desc: "Never miss a follow-up or interview with built-in reminders." },
          { emoji: "📄", title: "Document vault", desc: "Upload resumes and cover letters with full version history." },
          { emoji: "🤝", title: "Contact CRM", desc: "Track recruiters and hiring managers alongside each application." },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="flex gap-3 p-3.5 rounded-xl bg-[#f4f3f1]">
            <span className="text-xl shrink-0">{emoji}</span>
            <div>
              <p className="font-semibold text-sm text-[#1a1c1b]">{title}</p>
              <p className="text-xs text-[#55433d] mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: NESTAi intro ─────────────────────────────────────────────────────

function StepNestAi() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-xl bg-[#99462a]/10 flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-[#99462a]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1a1c1b]">Meet NESTAi</h2>
          <p className="text-sm text-[#88726c]">Your AI job search assistant</p>
        </div>
      </div>

      <p className="text-sm text-[#55433d] mb-4 leading-relaxed">
        NESTAi knows your entire job search — applications, interviews, contacts, and documents — and can help you at every step.
      </p>

      <div className="space-y-2.5">
        {[
          "Which applications haven't had a response in 2 weeks?",
          "Draft a follow-up email for my Google interview.",
          "Scan my resume against this job description.",
          "What interview is coming up next?",
        ].map((q) => (
          <div
            key={q}
            className="px-4 py-2.5 rounded-xl bg-[#f4f3f1] text-sm text-[#55433d] italic"
          >
            &ldquo;{q}&rdquo;
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[#88726c] text-center">
        Powered by Groq · Free: 5 messages/min · Pro: 30 messages/min
      </p>
    </div>
  );
}
