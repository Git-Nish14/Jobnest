"use client";

import { useState, useCallback } from "react";
import {
  Code2, Brain, ClipboardList, Calendar, MessageSquare,
  Flame, Trophy, BarChart3,
} from "lucide-react";
import type {
  CodingProblem, Assessment, BehavioralAnswer,
  MockInterview, InterviewQuestion, PrepStreak,
} from "@/types/prep";
import { CodingProblemsTracker } from "./coding-problems-tracker";
import { SystemDesignChecklist } from "./system-design-checklist";
import { BehavioralBank } from "./behavioral-bank";
import { AssessmentsTracker } from "./assessments-tracker";
import { MockInterviewScheduler } from "./mock-interview-scheduler";
import { InterviewQuestionLog } from "./interview-question-log";

type Tab = "problems" | "system-design" | "behavioral" | "assessments" | "mock" | "questions";

// Supabase returns joined tables as arrays even for many-to-one relations
export interface Interview {
  id: string;
  scheduled_at: string;
  type: string;
  job_applications?: { company?: string; position?: string } | { company?: string; position?: string }[] | null;
}

interface PrepHubProps {
  initialProblems: CodingProblem[];
  initialAssessments: Assessment[];
  initialBehavioral: BehavioralAnswer[];
  initialMockInterviews: MockInterview[];
  initialInterviewQuestions: InterviewQuestion[];
  initialStreak: PrepStreak | null;
  interviews: Interview[];
}

function ProgressRing({
  value, max, label, color, icon: Icon,
}: {
  value: number; max: number; label: string;
  color: string; icon: React.ElementType;
}) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = pct * circ;

  return (
    <div className="db-content-card flex flex-col items-center gap-3 py-5 px-4 text-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e9e8e6" strokeWidth="8" className="dark:stroke-[#1a1a1a]" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold db-headline text-[#1a1c1b]">{value}<span className="text-sm font-normal text-[#55433d] opacity-60">/{max}</span></p>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#55433d] opacity-60 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StreakBadge({ streak }: { streak: PrepStreak | null }) {
  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;

  return (
    <div className="db-content-card flex items-center gap-4 px-5 py-4">
      <div className="w-12 h-12 rounded-2xl bg-[#99462a]/10 flex items-center justify-center flex-shrink-0">
        <Flame className="w-6 h-6 text-[#99462a]" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold db-headline text-[#1a1c1b] leading-none">{current}</p>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#55433d] opacity-60">Day streak</p>
      </div>
      <div className="ml-auto text-right min-w-0">
        <p className="text-lg font-bold db-headline text-[#55433d]">{longest}</p>
        <p className="text-xs text-[#55433d] opacity-50">Best</p>
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType; short: string }[] = [
  { id: "problems",      label: "Coding Problems",  icon: Code2,         short: "Problems" },
  { id: "system-design", label: "System Design",    icon: BarChart3,     short: "System" },
  { id: "behavioral",    label: "Behavioral STAR",  icon: Brain,         short: "Behavioral" },
  { id: "assessments",   label: "Take-homes",       icon: ClipboardList, short: "Take-homes" },
  { id: "mock",          label: "Mock Interviews",  icon: Calendar,      short: "Mock" },
  { id: "questions",     label: "Question Log",     icon: MessageSquare, short: "Questions" },
];

export function PrepHub({
  initialProblems, initialAssessments, initialBehavioral,
  initialMockInterviews, initialInterviewQuestions, initialStreak, interviews,
}: PrepHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>("problems");
  const [problems, setProblems] = useState(initialProblems);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [behavioral, setBehavioral] = useState(initialBehavioral);
  const [mockInterviews, setMockInterviews] = useState(initialMockInterviews);
  const [interviewQuestions, setInterviewQuestions] = useState(initialInterviewQuestions);
  const [streak, setStreak] = useState(initialStreak);

  // Computed stats for progress rings
  const solvedProblems = problems.filter(p => p.status === "Solved").length;
  const systemDesignProgress = streak?.system_design_progress ?? {};
  const comfortableTopics = Object.values(systemDesignProgress).filter(s => s === "Comfortable").length;
  const behavioralDrafted = behavioral.filter(
    b => b.situation || b.task_desc || b.action || b.result
  ).length;
  const completedMocks = mockInterviews.filter(m => m.status === "Completed").length;

  const logActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/prep/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_activity: true }),
      });
      if (res.ok) {
        const { streak: updated } = await res.json();
        setStreak(updated);
      }
    } catch {
      // non-critical
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="db-page-header">
        <div>
          <h1 className="db-page-title">
            <span className="flex items-center gap-3">
              <Trophy className="w-9 h-9 text-[#99462a]" />
              Interview Prep
            </span>
          </h1>
          <p className="db-page-subtitle">
            Track LeetCode, system design, behavioral answers, and mock interviews in one hub.
          </p>
        </div>
        <StreakBadge streak={streak} />
      </div>

      {/* Progress rings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProgressRing value={solvedProblems} max={Math.max(problems.length, 1)} label="DSA Solved" color="#99462a" icon={Code2} />
        <ProgressRing value={comfortableTopics} max={15} label="System Design" color="#006d34" icon={BarChart3} />
        <ProgressRing value={behavioralDrafted} max={Math.max(behavioral.length, 1)} label="STAR Drafted" color="#d97757" icon={Brain} />
        <ProgressRing value={completedMocks} max={Math.max(mockInterviews.length, 1)} label="Mock Complete" color="#1e4a8a" icon={Calendar} />
      </div>

      {/* Tabs */}
      <div className="db-filter-bar">
        <div className="db-filter-pills">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`db-filter-pill ${activeTab === tab.id ? "db-filter-pill-active" : "db-filter-pill-inactive"}`}
            >
              <tab.icon className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "problems" && (
        <CodingProblemsTracker
          problems={problems}
          onChange={setProblems}
          onActivity={logActivity}
        />
      )}
      {activeTab === "system-design" && (
        <SystemDesignChecklist
          progress={streak?.system_design_progress ?? {}}
          onUpdate={async (updated) => {
            try {
              const res = await fetch("/api/prep/streak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ system_design_progress: updated, log_activity: true }),
              });
              if (res.ok) {
                const { streak: s } = await res.json();
                setStreak(s);
              }
            } catch {/* non-critical */}
          }}
        />
      )}
      {activeTab === "behavioral" && (
        <BehavioralBank
          answers={behavioral}
          onChange={setBehavioral}
          onActivity={logActivity}
        />
      )}
      {activeTab === "assessments" && (
        <AssessmentsTracker
          assessments={assessments}
          onChange={setAssessments}
          onActivity={logActivity}
        />
      )}
      {activeTab === "mock" && (
        <MockInterviewScheduler
          mockInterviews={mockInterviews}
          onChange={setMockInterviews}
          onActivity={logActivity}
        />
      )}
      {activeTab === "questions" && (
        <InterviewQuestionLog
          questions={interviewQuestions}
          interviews={interviews}
          onChange={setInterviewQuestions}
        />
      )}
    </div>
  );
}
