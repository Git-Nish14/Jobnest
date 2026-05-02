"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, BookOpen, ExternalLink } from "lucide-react";
import type { SystemDesignStatus } from "@/types/prep";
import { SYSTEM_DESIGN_TOPICS } from "@/types/prep";

const RESOURCES: Record<string, string> = {
  "Load Balancer": "https://github.com/donnemartin/system-design-primer#load-balancer",
  "CDN": "https://github.com/donnemartin/system-design-primer#content-delivery-network",
  "Database Sharding": "https://github.com/donnemartin/system-design-primer#sharding-or-data-partitioning",
  "CAP Theorem": "https://github.com/donnemartin/system-design-primer#cap-theorem",
  "Rate Limiting": "https://github.com/donnemartin/system-design-primer#rate-limiter",
  "Message Queues": "https://github.com/donnemartin/system-design-primer#asynchronism",
  "Caching": "https://github.com/donnemartin/system-design-primer#cache",
  "Consistent Hashing": "https://github.com/donnemartin/system-design-primer#consistent-hashing",
  "SQL vs NoSQL": "https://github.com/donnemartin/system-design-primer#sql-or-nosql",
  "Microservices": "https://microservices.io/patterns/microservices.html",
  "API Design (REST/GraphQL)": "https://github.com/donnemartin/system-design-primer#representational-state-transfer-rest",
  "WebSockets": "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API",
  "Search Systems": "https://github.com/donnemartin/system-design-primer#elasticsearch",
  "Distributed Transactions": "https://github.com/donnemartin/system-design-primer#sql-or-nosql",
  "Monitoring & Observability": "https://sre.google/workbook/monitoring/",
};

const STATUS_ORDER: SystemDesignStatus[] = ["Not Started", "Reading", "Comfortable"];
const STATUS_STYLES: Record<SystemDesignStatus, { pill: string; icon: string }> = {
  "Not Started": { pill: "bg-[#55433d]/8 text-[#55433d]", icon: "text-[#dbc1b9]" },
  "Reading":     { pill: "bg-[#7c5200]/10 text-[#7c5200]", icon: "text-[#d97757]" },
  "Comfortable": { pill: "bg-[#006d34]/10 text-[#006d34]", icon: "text-[#006d34]" },
};

interface Props {
  progress: Record<string, SystemDesignStatus>;
  onUpdate: (updated: Record<string, SystemDesignStatus>) => Promise<void>;
}

export function SystemDesignChecklist({ progress, onUpdate }: Props) {
  const [localProgress, setLocalProgress] = useState(progress);
  const [, startTransition] = useTransition();

  const advance = (topic: string) => {
    const current: SystemDesignStatus = localProgress[topic] ?? "Not Started";
    const idx = STATUS_ORDER.indexOf(current);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    const updated = { ...localProgress, [topic]: next };
    setLocalProgress(updated);
    startTransition(() => onUpdate(updated));
  };

  const comfortable = Object.values(localProgress).filter(s => s === "Comfortable").length;
  const reading = Object.values(localProgress).filter(s => s === "Reading").length;

  return (
    <div className="space-y-6">
      {/* Legend + progress */}
      <div className="db-content-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="db-headline text-lg font-semibold text-[#1a1c1b]">System Design Topics</h3>
            <p className="text-sm text-[#55433d] opacity-60 mt-0.5">Click a topic to cycle through: Not Started → Reading → Comfortable</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold db-headline text-[#1a1c1b]">{comfortable}<span className="text-base font-normal text-[#55433d] opacity-60">/{SYSTEM_DESIGN_TOPICS.length}</span></p>
            <p className="text-xs text-[#55433d] opacity-50 uppercase tracking-wider">Comfortable</p>
          </div>
        </div>

        {/* Progress bar — width set imperatively via ref to satisfy no-inline-styles rule */}
        <div className="h-2 bg-[#e9e8e6] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#006d34] rounded-full transition-all duration-500"
            ref={(el) => { if (el) el.style.width = `${Math.round((comfortable / SYSTEM_DESIGN_TOPICS.length) * 100)}%`; }}
          />
        </div>
        <div className="flex gap-4 text-xs text-[#55433d] opacity-60">
          <span>{comfortable} comfortable</span>
          <span>{reading} reading</span>
          <span>{SYSTEM_DESIGN_TOPICS.length - comfortable - reading} not started</span>
        </div>
      </div>

      {/* Topic grid */}
      <div className="grid sm:grid-cols-2 gap-3">
        {SYSTEM_DESIGN_TOPICS.map(topic => {
          const status: SystemDesignStatus = localProgress[topic] ?? "Not Started";
          const styles = STATUS_STYLES[status];

          return (
            <div key={topic} className="db-content-card flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => advance(topic)}>
              {/* Status icon */}
              <div className="flex-shrink-0">
                {status === "Comfortable"
                  ? <CheckCircle2 className={`w-6 h-6 ${styles.icon}`} />
                  : <Circle className={`w-6 h-6 ${styles.icon} ${status === "Reading" ? "fill-current opacity-30" : ""}`} />}
              </div>

              {/* Topic */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#1a1c1b] group-hover:text-[#99462a] transition-colors">{topic}</p>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles.pill}`}>{status}</span>
              </div>

              {/* Resource link */}
              {RESOURCES[topic] && (
                <a
                  href={RESOURCES[topic]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 text-[#55433d] opacity-30 hover:opacity-70 transition-opacity"
                  title="Study resource"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Resource banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#99462a]/8 border border-[#99462a]/20">
        <BookOpen className="w-4 h-4 text-[#99462a] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="font-semibold text-[#99462a]">Free resource: </span>
          <a href="https://github.com/donnemartin/system-design-primer" target="_blank" rel="noopener noreferrer"
            className="text-[#99462a] underline underline-offset-2 hover:opacity-70 transition-opacity">
            system-design-primer on GitHub
          </a>
          <span className="text-[#55433d] opacity-60"> — the gold standard for interview prep</span>
        </div>
      </div>
    </div>
  );
}
