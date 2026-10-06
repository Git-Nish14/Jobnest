# Search workspace implementation

Implemented October 6, 2026. This records the delivered dashboard and planning foundation from [the product plan](DASHBOARD_ANALYSIS_AND_PRODUCT_PLAN.md). It does not mark the entire multi-phase roadmap complete.

## Delivered behavior

- `/dashboard` opens an action-oriented home on both mobile and desktop. Next actions includes overdue reminders, interview preparation, and assessment deadlines. Exact reminder/interview totals are independent of bounded previews. Reminders support complete, undo, and snooze.
- The weekly planner reads the existing `user_metadata.weekly_goal`. It subtracts submitted applications this week, schedules remaining work over available days, reserves time for commitments, and surfaces capacity or saved-role shortfalls. Supporting preparation, sourcing, networking drafts, and review never increase application-goal progress.
- Users can save weekly minutes, application-time estimates, available days, Sunday/Monday week start, and a pause preference. The initial 300-minute availability is explicitly a preview until configured. A goal change uses the existing save endpoint; failed saves do not display a different target as authoritative.
- Plan suggestions support skip/restore, completion for supporting work, and rescheduling. Task state belongs to the authenticated user and current week, with database row-level security. This persists decisions across devices; the schedule itself is recalculated from current records and saved preferences.
- Saved and Preparing are separate from submitted applications. Accepted is supported across schema, forms, lists, board, CSV validation, and ChatGPT saves. The first transition from a saved role records submission without reusing its original saved date; explicitly edited historical application dates are preserved.
- Analytics pages through the full application/event history. Historical stages remain counted after rejection or withdrawal. Missing stages are not inferred; current imported offers alone do not prove interview entry.
- Response time uses recorded response-stage dates, includes same-day replies, and is displayed as an approximate recorded median. A note edit cannot change it. Interview conversion uses observed, resolved interviews and separately reports pending cases.
- Source comparisons separate any reply from positive progression, exclude recent applications from the 30-day comparison cohort, and show unresolved/small samples. They do not prescribe a winning source. Weekday charts describe habits, without claiming a best hiring day.
- `/dashboard?view=insights` contains deeper analysis and the weekly report. Reports reuse the saved weekly goal and corrected analytics; unsupported industry conversion benchmarks were removed.
- Recent roles sort by latest update so changes to older opportunities remain visible. Interview preparation links open relevant role requirements/notes; assessments open their preparation tab.
- Analytics read failures produce an explicit retry state. Task persistence availability is reported separately. Time windows follow the stored user timezone and chosen week start.
- NESTAi receives the authoritative goal/search summary and corrected reminder/contact/interview/salary field aliases. It is instructed to respect capacity, distinguish saved from submitted, and explain uncertainty.
- Automatic follow-up cadence uses application date instead of record creation date, excludes active screens, and respects a paused search. Silent roles are proposed for review rather than automatically called ghosted.
- The migration stops rejection-triggered automatic document deletion and retains pending purge entries. Application tracking completeness is clarified as saved context, not hiring likelihood.

## Database rollout

Apply these migrations in order to the existing database **before deploying the updated application**:

1. [055: lifecycle values](../supabase/migrations/20240101000055_search_lifecycle.sql).
2. [056: submission history and task persistence](../supabase/migrations/20240101000056_search_planning.sql).
3. [057: ChatGPT validator alignment](../supabase/migrations/20240101000057_chatgpt_search_lifecycle.sql).

Migration 055 must commit before 056 uses its new PostgreSQL enum values. Migration 056 adds `saved_date`, `submitted_at`, and the owner-scoped `search_plan_tasks` table, replaces activity logging to retain initial stages, and stops automatic rejection purges. Existing application dates are preserved. `submitted_at` is when the user recorded submission, not an employer-verified timestamp. Migration 057 updates only the existing save function and preserves connections and permissions.

The migrations were executed against isolated PostgreSQL through PGlite. They have **not** been applied to hosted Supabase, and no site deployment was performed.

## Verification

- TypeScript and production Next build passed.
- Unit/flow suite: 2,137 tests across 125 files passed.
- Database checks: 11 passed, covering lifecycle dates, history, retention, row-level ownership, and existing/new ChatGPT saves.
- Browser suite: 38 checks passed. These exercise actual components and CSS at mobile and desktop widths, including failed goal saves, retry, unchanged application progress after supporting tasks, reminder undo, pause, and horizontal overflow. Existing gesture, filter, status, and form regressions passed too.
- Desktop and mobile planner screenshots were inspected. Day sections collapse around today's work to reduce scrolling.

The browser fixtures use isolated data and mocked API responses. They do not replace authenticated staging tests against the deployed schema, a physical-phone audit, or user research.

Reproduce local checks from `web` using `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:mobile`. On this Windows environment, invoke `npm.cmd` because PowerShell script execution is disabled. The database test is `node supabase/tests/search-planning.mjs` from the repository root with `PGLITE_MODULE_PATH` pointing to the PGlite package entry; its dependency was installed in a temporary directory, not added to the app.

## Remaining roadmap

- User research, real deployment/schema verification, and the specialized work-authorization guidance review.
- Campaign/archive management, explicit employer-event occurrence dates/corrections, and immutable submitted-document snapshots.
- Server-persisted resume-tailoring checklists and candidate-resume-specific tailoring; the existing checklist still uses JD-only generation and local browser storage.
- Browser capture/autofill, email reconciliation, calendar integrations, richer role preferences, and selective discovery.
- History-based duration learning, outcome experiments, calibrated predictive models, and an opt-in ML pilot.

The delivered planner uses transparent scheduling rules and saved user preferences. It is not presented as ML, and it does not infer better hiring weekdays from application counts. Predictive rollout still depends on the data-quality, validation, and user-benefit gates in the product plan.
