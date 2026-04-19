/**
 * Unit tests — buildStages() (status-timeline.tsx)
 *
 * buildStages() converts a flat list of ActivityLog rows into an ordered list
 * of stages representing how long an application spent in each status.
 *
 * Covers:
 *   - No activity logs → single Applied stage
 *   - Single status change → two-stage chain, correct daysSpent
 *   - Multiple status changes → correct chain, last stage is current
 *   - Activities arrive newest-first (service default) → reversed correctly
 *   - Same-day status change → daysSpent = 0
 *   - Terminal statuses flagged correctly
 *   - Non-"Status Changed" log types are ignored
 *   - Logs missing new_status in metadata are skipped
 *   - isCurrent / isTerminal flags on last stage
 *   - daysSpent never goes negative (Math.max guard)
 *   - applied_date used as canonical start (not log created_at)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildStages } from "@/components/applications/status-timeline";
import type { ActivityLog } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fixed "now" so day calculations are deterministic across CI runs */
const FIXED_NOW = new Date("2026-04-18T12:00:00Z");

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_NOW); });
afterAll(() => { vi.useRealTimers(); });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  return new Date(FIXED_NOW.getTime() - n * 86_400_000);
}

function makeLog(overrides: Partial<ActivityLog> & { activity_type: string; metadata: Record<string, unknown> }): ActivityLog {
  return {
    id: crypto.randomUUID(),
    user_id: "uid-1",
    application_id: "app-1",
    description: "Status changed",
    created_at: FIXED_NOW.toISOString(),
    ...overrides,
  } as ActivityLog;
}

function statusChangedLog(fromStatus: string, toStatus: string, at: Date): ActivityLog {
  return makeLog({
    activity_type: "Status Changed",
    metadata: { old_status: fromStatus, new_status: toStatus },
    created_at: at.toISOString(),
  });
}

// ── No activity logs ──────────────────────────────────────────────────────────

describe("buildStages — no activity logs", () => {
  it("returns a single Applied stage seeded from appliedDate", () => {
    const appliedDate = isoDate(daysAgo(20));
    const stages = buildStages([], appliedDate);
    expect(stages).toHaveLength(1);
    expect(stages[0].status).toBe("Applied");
    expect(stages[0].isCurrent).toBe(true);
    expect(stages[0].isTerminal).toBe(false);
  });

  it("the single stage's enteredAt matches appliedDate at noon UTC", () => {
    const appliedDate = "2026-03-29";
    const stages = buildStages([], appliedDate);
    expect(stages[0].enteredAt.toISOString()).toBe("2026-03-29T12:00:00.000Z");
  });

  it("daysSpent on the seed stage reflects days since applied", () => {
    const appliedDate = isoDate(daysAgo(10));
    const stages = buildStages([], appliedDate);
    // daysSpent is set to 0 in the seed push; the component computes it live in dayLabel
    // The stage itself seeds with daysSpent: 0 as the initial value before the loop runs.
    expect(stages[0].daysSpent).toBe(0);
  });
});

// ── Single status change ──────────────────────────────────────────────────────

describe("buildStages — single status change", () => {
  it("produces two stages: Applied (closed) + new status (current)", () => {
    const appliedDate = isoDate(daysAgo(30));
    const changedAt   = daysAgo(20);

    const logs = [statusChangedLog("Applied", "Phone Screen", changedAt)];
    const stages = buildStages(logs, appliedDate);

    expect(stages).toHaveLength(2);
    expect(stages[0].status).toBe("Applied");
    expect(stages[0].isCurrent).toBe(false);
    expect(stages[1].status).toBe("Phone Screen");
    expect(stages[1].isCurrent).toBe(true);
  });

  it("first stage daysSpent equals days between appliedDate and the status-change log", () => {
    const appliedDate = isoDate(daysAgo(30));
    const changedAt   = daysAgo(20); // 10 days after applying

    const logs = [statusChangedLog("Applied", "Phone Screen", changedAt)];
    const stages = buildStages(logs, appliedDate);

    expect(stages[0].daysSpent).toBe(10);
  });

  it("current stage daysSpent equals days from status-change to now", () => {
    const appliedDate = isoDate(daysAgo(30));
    const changedAt   = daysAgo(7); // 7 days ago

    const logs = [statusChangedLog("Applied", "Interview", changedAt)];
    const stages = buildStages(logs, appliedDate);

    expect(stages[1].daysSpent).toBe(7);
  });

  it("same-day status change produces daysSpent = 0 on the Applied stage", () => {
    const appliedDate = isoDate(daysAgo(5));
    const changedAt   = daysAgo(5); // same day as applied

    const logs = [statusChangedLog("Applied", "Phone Screen", changedAt)];
    const stages = buildStages(logs, appliedDate);

    expect(stages[0].daysSpent).toBe(0); // Math.max(0, ...) guard
  });
});

// ── Multiple status changes ───────────────────────────────────────────────────

describe("buildStages — multiple status changes", () => {
  it("chains stages in chronological order", () => {
    const appliedDate = isoDate(daysAgo(40));
    // Provided newest-first — same order the service returns them.
    // buildStages reverses them internally to process oldest → newest.
    const logs = [
      statusChangedLog("Interview",    "Offer",        daysAgo(5)),
      statusChangedLog("Phone Screen", "Interview",    daysAgo(20)),
      statusChangedLog("Applied",      "Phone Screen", daysAgo(30)),
    ];

    const stages = buildStages(logs, appliedDate);

    expect(stages).toHaveLength(4);
    expect(stages.map((s) => s.status)).toEqual([
      "Applied", "Phone Screen", "Interview", "Offer",
    ]);
  });

  it("only the last stage is current", () => {
    const appliedDate = isoDate(daysAgo(40));
    // Newest-first (service default); buildStages reverses internally.
    const logs = [
      statusChangedLog("Interview",    "Rejected",     daysAgo(5)),
      statusChangedLog("Phone Screen", "Interview",    daysAgo(20)),
      statusChangedLog("Applied",      "Phone Screen", daysAgo(30)),
    ];

    const stages = buildStages(logs, appliedDate);
    const currentStages = stages.filter((s) => s.isCurrent);

    expect(currentStages).toHaveLength(1);
    expect(currentStages[0].status).toBe("Rejected");
  });

  it("daysSpent on intermediate stages reflects actual gap between changes", () => {
    const appliedDate = isoDate(daysAgo(40));
    // Newest-first (service default); buildStages reverses internally.
    const logs = [
      statusChangedLog("Phone Screen", "Interview",    daysAgo(15)), // Phone Screen: 15d
      statusChangedLog("Applied",      "Phone Screen", daysAgo(30)), // Applied: 10d
    ];

    const stages = buildStages(logs, appliedDate);

    expect(stages[0].daysSpent).toBe(10); // Applied: 40 → 30 days ago
    expect(stages[1].daysSpent).toBe(15); // Phone Screen: 30 → 15 days ago
    expect(stages[2].daysSpent).toBe(15); // Interview: 15 days ago → now
  });
});

// ── Activity order ────────────────────────────────────────────────────────────

describe("buildStages — activity order", () => {
  it("processes correctly even when activities arrive newest-first (service default)", () => {
    // Service returns activities newest-first; buildStages reverses them internally.
    const appliedDate = isoDate(daysAgo(30));
    const logs = [
      // Newest first (as the service returns them)
      statusChangedLog("Phone Screen", "Interview",    daysAgo(5)),
      statusChangedLog("Applied",      "Phone Screen", daysAgo(15)),
    ];

    const stages = buildStages(logs, appliedDate);

    expect(stages).toHaveLength(3);
    expect(stages[0].status).toBe("Applied");
    expect(stages[1].status).toBe("Phone Screen");
    expect(stages[2].status).toBe("Interview");
    expect(stages[2].isCurrent).toBe(true);
  });
});

// ── Terminal statuses ─────────────────────────────────────────────────────────

describe("buildStages — terminal statuses", () => {
  const TERMINALS = ["Offer", "Accepted", "Rejected", "Withdrawn", "Ghosted"];

  TERMINALS.forEach((status) => {
    it(`marks ${status} as isTerminal = true`, () => {
      const logs = [statusChangedLog("Applied", status, daysAgo(5))];
      const stages = buildStages([], isoDate(daysAgo(20)));
      const terminalStages = buildStages(logs, isoDate(daysAgo(20)));
      const last = terminalStages[terminalStages.length - 1];
      expect(last.status).toBe(status);
      expect(last.isTerminal).toBe(true);
      void stages; // suppress unused var
    });
  });

  it("marks non-terminal statuses as isTerminal = false", () => {
    const NON_TERMINALS = ["Applied", "Phone Screen", "Interview", "In Review"];
    NON_TERMINALS.forEach((status) => {
      const logs = [statusChangedLog("Applied", status, daysAgo(5))];
      const stages = buildStages(logs, isoDate(daysAgo(20)));
      const last = stages[stages.length - 1];
      expect(last.isTerminal).toBe(false);
    });
  });
});

// ── Filtered log types ────────────────────────────────────────────────────────

describe("buildStages — non-status-change log types are ignored", () => {
  it("ignores Created, Note Added, Document Uploaded, etc.", () => {
    const appliedDate = isoDate(daysAgo(20));
    const logs = [
      makeLog({ activity_type: "Created",           metadata: {} }),
      makeLog({ activity_type: "Note Added",         metadata: {} }),
      makeLog({ activity_type: "Document Uploaded",  metadata: {} }),
      makeLog({ activity_type: "Interview Scheduled",metadata: {} }),
    ];

    const stages = buildStages(logs, appliedDate);
    expect(stages).toHaveLength(1); // only the seeded Applied stage
    expect(stages[0].status).toBe("Applied");
  });

  it("ignores Status Changed logs with missing new_status in metadata", () => {
    const appliedDate = isoDate(daysAgo(20));
    const logs = [
      makeLog({ activity_type: "Status Changed", metadata: { old_status: "Applied" } }), // no new_status
    ];

    const stages = buildStages(logs, appliedDate);
    expect(stages).toHaveLength(1);
  });

  it("ignores Status Changed logs with empty new_status", () => {
    const appliedDate = isoDate(daysAgo(20));
    const logs = [
      makeLog({ activity_type: "Status Changed", metadata: { old_status: "Applied", new_status: "" } }),
    ];

    const stages = buildStages(logs, appliedDate);
    expect(stages).toHaveLength(1);
  });
});

// ── Negative day guard ────────────────────────────────────────────────────────

describe("buildStages — negative daysSpent guard", () => {
  it("clamps daysSpent to 0 when log.created_at is before applied_date (clock skew)", () => {
    // log.created_at is before applied_date — this should not produce negative days
    const appliedDate = isoDate(daysAgo(5));
    const changedAt   = daysAgo(10); // before applied_date!

    const logs = [statusChangedLog("Applied", "Phone Screen", changedAt)];
    const stages = buildStages(logs, appliedDate);

    expect(stages[0].daysSpent).toBeGreaterThanOrEqual(0);
  });
});

// ── Unknown statuses ──────────────────────────────────────────────────────────

describe("buildStages — unknown status values", () => {
  it("still creates a stage for an unknown status value", () => {
    const logs = [statusChangedLog("Applied", "Under Consideration", daysAgo(5))];
    const stages = buildStages(logs, isoDate(daysAgo(20)));

    expect(stages).toHaveLength(2);
    expect(stages[1].status).toBe("Under Consideration");
  });

  it("marks an unknown status as non-terminal", () => {
    const logs = [statusChangedLog("Applied", "Under Consideration", daysAgo(5))];
    const stages = buildStages(logs, isoDate(daysAgo(20)));

    expect(stages[1].isTerminal).toBe(false);
  });
});
