# Jobnest dashboard analysis and product plan

Date: October 6, 2026

Status: Analysis and proposed plan only. No application code changed.

## 1. Product direction

**Make Jobnest the place a job seeker opens to know what to do next, act with less effort, and learn what is working.** Becoming the best job-hunting tracker requires trustworthy records, useful decisions, and excellent everyday execution. Feature count alone will not establish that position.

The current app has a substantial foundation: applications, documents, interviews, reminders, networking, compensation tools, preparation, and NESTAi. Its largest opportunity is connecting these into one dependable workflow. Today, the desktop dashboard mostly describes activity; the mobile dashboard moves closer to action, but its recommendations are simple condition-based messages.

Recommended order:

1. Repair misleading metrics and missing urgent work.
2. Make the dashboard a daily action workspace.
3. Reduce capture and maintenance effort.
4. Turn the existing weekly application goal into an editable plan based on time and deadlines.
5. Introduce evidence-based personalization, then ML where it demonstrably helps.

The user's personalized-plan suggestion is valuable. Ship the useful planning experience early; progressively improve its recommendations as reliable evidence accumulates. A long account history alone is not enough to justify a model or a confident recommendation about application timing.

**Confirmed scope: reuse the existing weekly goal.** The planner should schedule how to achieve it, not introduce a second application goal or silently choose a different target. Additional availability and search preferences support that existing goal.

## 2. Review scope and evidence

This review inspected the actual dashboard composition, its analytics service, mobile home, chart components, application workflow and validation, activity history, database migrations, reminders, onboarding/profile goals, document handling, NESTAi context, and adjacent preparation/networking/salary workflows. The README was orientation, not proof of implementation.

This is a source-based product review with simulated user journeys. No signed-in browser session was available. I did not create an account, access production user records, change settings, or perform a visual or assistive-technology audit. Findings about formulas and conditional rendering are directly supported by code; judgments about confusion, usefulness, and retention are hypotheses to validate with users. Deployment configuration and live schema may differ from this repository.

Key evidence locations:

| Reference | Files | What they establish |
|---|---|---|
| E1 | [Dashboard page](<../web/app/(dashboard)/dashboard/page.tsx>), [mobile home](../web/components/dashboard/mobile-job-search-home.tsx) | What is actually shown, its order, visibility gates, and mobile/desktop differences. |
| E2 | [Analytics service](../web/services/analytics.ts) | Queries, date windows, response definitions, funnel construction, and sample thresholds. |
| E3 | [Weekday chart](../web/components/dashboard/weekday-activity-chart.tsx), [funnel chart](../web/components/dashboard/stage-funnel-chart.tsx), [insights](../web/components/dashboard/analytics-insights.tsx) | Labels, fixed benchmarks, and the advice presented to users. |
| E4 | [Tasks panel](../web/components/dashboard/atelier-tasks-panel.tsx), [weekly cadence](../web/components/dashboard/weekly-cadence.tsx) | Completion behavior, goal persistence, repeated velocity chart, and report access. |
| E5 | [Application service](../web/services/applications.ts), [status constants](../web/config/constants.ts), [validation](../web/lib/validations/application.ts), [application types](../web/types/application.ts) | Supported workflow, filtering, sorting, fields, and status contract. |
| E6 | [Activity migration](../supabase/migrations/20240101000019_activity_logs.sql), [activity service](../web/services/activity-logs.ts), [stage timeline](../web/components/applications/status-timeline.tsx) | Existing status-change history and the limits of recorded dates. |
| E7 | [Onboarding](../web/components/onboarding/OnboardingWizard.tsx), [profile client](../web/components/profile/profile-client.tsx), [goal endpoint](../web/app/api/profile/update-weekly-goal/route.ts) | Current onboarding, free-text context, and application-count goal. |
| E8 | [Follow-up cron](../web/app/api/cron/follow-up-reminders/route.ts), [reminder schema](../supabase/migrations/20240101000003_enhanced_features.sql) | Automated cadence and actual reminder field names. |
| E9 | [NESTAi route](../web/app/api/nesta-ai/route.ts), [retrieval layer](../web/lib/features/nestai-rag.ts) | Existing contextual chat and data supplied to it. |
| E10 | [Completeness](../web/lib/utils/completeness.ts), [tailoring checklist](../web/components/applications/tailoring-checklist.tsx), [checklist generation](<../web/app/api/applications/[id]/tailoring-checklist/route.ts>) | Current checklist criteria, device-local state, and JD-only recommendations. |
| E11 | [Salary parser](../web/lib/utils/salary-parse.ts), [salary chart](../web/components/dashboard/avg-salary-chart.tsx), [benchmark](../web/components/salary/SalaryBenchmark.tsx) | Free-text compensation aggregation and fixed junior SWE reference values. |
| E12 | [Document purge migration](../supabase/migrations/20240101000035_document_purge_queue.sql), [retention banner](../web/components/applications/document-purge-banner.tsx) | Rejection-triggered document deletion and the existing retain option. |
| E13 | [Prep hub](../web/components/prep/prep-hub.tsx), [networking schema](../supabase/migrations/20240101000043_networking.sql), [navbar](../web/components/layout/Navbar.tsx) | Adjacent capabilities and navigation organization. |
| E14 | [OPT banner](../web/components/dashboard/OPTCountdownBanner.tsx), [H-1B card](../web/components/dashboard/H1BTrackerCard.tsx), [Supabase config](../supabase/config.toml) | Deadline assumptions and repository API row cap. |

## 3. What the dashboard already offers, and its actual user value

These are the elements rendered by the current dashboard, not every component that happens to exist in the dashboard directory.

| Current element | Why a user might need it | Assessment and proposed treatment |
|---|---|---|
| Welcome and active-search summary | Quick orientation when returning. | Keep, but mention concrete urgency and dates. A greeting should not take space from due work. |
| Total applications, with this week's count | Reassures users that their records are captured; shows recent effort. | Useful supporting context. Reduce prominence; total volume does not tell someone whether their search is healthy. |
| Upcoming interview count and next company/type | Helps users anticipate preparation. | High value. Show next date/time, timezone, round, and a role-specific prep action. Current count is the length of a query limited to five, not an exact total. |
| Offers received and Review Offer | Highlights major progress. | High value when offers exist. Count historically received offers separately from current status, and surface decision deadlines. Generic encouragement with zero offers supplies little information. |
| Application Velocity, daily/weekly/monthly | Reveals consistency, bursts, and changes in activity. | Keep in deeper insights; show goal and period context. Activity should include meaningful preparation/networking where appropriate, not only applications. |
| Upcoming tasks with completion | Converts tracking into action. | Essential. Currently excludes overdue reminders upstream and shows only three rows. It must become a complete urgency-based queue. |
| Motivational quote in tasks | Emotional reassurance for some users. | Low practical value. Make encouragement optional and contextual; reserve prime space for actions and useful explanations. |
| Application Pipeline donut, response rate, in-progress/offers | Provides a compact current-status snapshot. | Keep a compact snapshot. Label it as current distribution; distinguish it from historical stage conversion. Offer a list of the underlying roles. |
| Recent applications | Fast return to recently applied roles. | Useful, but sorting by applied date misses an older role with a new interview or message. Add Recently changed and Needs attention views. |
| Document Library shortcut | Retrieves the right materials quickly. | Useful tool. Make it contextual to a selected role or plan task. A static shortcut is secondary to the application-specific document workflow. |
| ATS Scanner shortcut | Encourages review before applying. | Useful when grounded in specific, truthful edits. Prefer Scan this role with this resume. A score alone is not a hiring probability. |
| Monthly Breakdown: applied, rejected, offers | Longer-term search review. | Useful after definition repair. Currently groups by application month and current outcome; it is not a calendar of when offers/rejections occurred. |
| Best Day to Apply | Appears to answer the user's timing question. | Misleading title. It counts application volume by weekday. Rename Your application schedule; add outcome comparisons only when supported. |
| Top Companies by count | Shows where applications are concentrated. | Low default value. Frequency is not desirability or success. Move to Insights; consider concentration warnings and user-selected target companies instead. |
| Application Funnel with conversion rates | Could locate where opportunities stop progressing. | Potentially one of the best analytical tools, but current-status inference loses history. Repair before using it to give advice. |
| Average Salary by Source | Could help choose channels with suitable compensation. | Low default value and misleading across currencies/pay periods. Move to Salary/Insights, normalize values, and show sample/coverage and comparable roles. |
| Source Effectiveness | Could direct sourcing effort. | High potential. Separate rejection replies from positive progression, compare equally mature cohorts, and display uncertainty. |
| Response Rate by Tier | Could reveal patterns in target-company selection. | Optional. Current small samples and subjective tiers do not justify strategy changes. Role level, fit, location, and industry may be more useful dimensions. |
| Search Intelligence: response time | Helps set expectations and decide when to check in. | High potential, but last edit time is not response time. Use actual first-response events and median/range. |
| Search Intelligence: interview-to-offer | Helps focus preparation effort. | High potential, but current denominator misses rejected interviewees. Include unresolved outcomes and observed history. |
| Search Intelligence: ghosting | Helps users notice stale applications. | Useful as Needs status review. Silence is not confirmed rejection, and old Applied records can also reflect missing updates. |
| Search Intelligence: live opportunities | Reassures users about conversations underway. | Useful; explicitly call it Active conversations. It currently means Phone Screen + Interview, unlike the broader active count elsewhere. |
| Search Intelligence: weekly momentum | Highlights pace changes. | Often weak advice. A partial week is compared to full weeks; prep-heavy weeks can be successful without more applications. Show matched elapsed-period comparisons and goal context. |
| Search Intelligence: best source | Could prioritize time. | Duplicates Source Effectiveness and currently overstates weak evidence. Replace with one evidence-backed recommendation when warranted. |
| Weekly Cadence and editable count goal | Supports accountability and makes a weekly target tangible. | Reuse as the planner's application target and single source of truth. Move up, add time budget and task mix; the second velocity chart is redundant. It is currently absent from mobile home. |
| Weekly PDF report | Supports reflection or career-coach conversations. | Keep secondary; add a useful in-app weekly review first. PDF should use the same corrected metric definitions. |
| Floating Add Application action | Makes recording easy to find. | Keep accessible. Offer quick capture with minimal required fields and preserve pending drafts. |
| Conditional OPT/H-1B cards | Recognizes users with time-sensitive work authorization. | Potentially valuable, but assumptions need review. Use user-confirmed document dates and maintained official resources. Generic season/card logic cannot determine an individual's deadline. |

Extended desktop analytics appear after just three applications (E1). That is a layout threshold, not evidence that all charts have meaningful data. Introduce widget-specific eligibility and a clear small-sample state.

### Mobile and desktop are currently different products in meaningful ways

Mobile has a Best next move card, active/weekly/response summaries, follow-up/ATS/NESTAi shortcuts, and recent roles. This is a better starting direction for daily use. However:

- The best-next-move rule is simply interview present, else active applications present, else add a role. It does not prioritize an overdue follow-up, imminent assessment, or offer deadline.
- Prepare now links to the general interviews page, rather than opening a preparation task for the specific role.
- Desktop analytics, the weekly goal editor/report, and the weekly cadence are hidden from mobile home without an equivalent Insights entry there.
- Reminder count is derived from a future-only query capped at five; it does not represent all remaining work.

Preserve a concise mobile home while giving both devices access to the same goals, tasks, plan, and insights. Different layouts are appropriate; different core capabilities need a deliberate reason.

## 4. Trust issues to address before adding more intelligence

### 4.1 Historical progress is confused with current status

E2 builds the funnel by placing current status in an ordered array. Rejected, Withdrawn, and Ghosted are absent from that array. Consequently, a candidate who interviewed and was then rejected disappears from the historical interview funnel. The first Applied funnel count can also be lower than total applications.

The interview-to-offer calculation uses current Interview + Offer + Accepted statuses. Example: ten applications reached interviews, one got an offer, and nine were rejected. Current-status data can omit the nine interview failures entirely; the calculation may be suppressed by its minimum-three threshold rather than report the real history. With some still-active interviews, it can instead substantially inflate conversion.

**Plan:** use distinct applications with verified stage-entry/response/offer events. Preserve reached-stage history after closure. Separate active pipeline from historical progression. Show pending outcomes and missing-history coverage. Do not silently invent skipped stages in imported records.

### 4.2 Response time is based on last edit time

E2 uses `updated_at - applied_date`, discards same-day values, and caps delays at 90 days. Editing notes weeks after a reply changes the apparent response time. The cap masks some errors without measuring the intended event.

**Plan:** record employer-response time independently, including user correction and provenance. Use existing status-change logs as explicitly approximate historical evidence where appropriate. Include same-day responses; represent date-only precision honestly. Show median response time and the number of usable events.

### 4.3 Reply rate is not positive progress

Rejected is included in response-rate/source-rate calculations. That can be useful when labeled Any employer reply, but Best source currently recommends doubling down on the highest reply rate. A channel with prompt rejections could win that ranking. A later withdrawal can also erase a previously recorded reply under current-status counting.

**Plan:** show separate metrics for any reply, positive progression to a screen/interview, interview reached, and offer received. Use event history rather than present status. Recommend channels using progress toward the user's goal, suitable roles, time cost, and uncertainty.

### 4.4 The weekday chart does not measure employer effectiveness

E3 labels application counts Best Day to Apply. If a user applies on Saturday because that is their only free day, the chart calls Saturday best without any outcome evidence.

**Plan:** distinguish Days you usually apply from Outcomes by application day. Even outcome correlation is not proof that the day caused success. Role/source mix, application quality, posting age, season, and available time can explain differences. Never tell users to delay a suitable, time-sensitive posting for a supposedly better weekday.

### 4.5 The dashboard omits overdue work and understates counts

E2 requires incomplete reminders to have `remind_at >= now`, limits results to five, and the panel shows three. Users can have overdue tasks and see No pending reminders. Interviews are also limited to five and their returned list length is displayed as a count.

**Plan:** exact counts plus separately limited previews. Queue overdue and due-today items first, then imminent interviews/assessments/offer decisions. Fetch role context and offer a direct open action. Completion should update the queue without a full reload, with recovery for accidental completion.

### 4.6 Sample size and unsupported guidance are too permissive

Source/tier percentages appear with two applications in a group, and topSource does not require two qualifying source groups despite the UI copy. Fixed funnel benchmarks are attributed only in comments to entry-level SWE sources; there is no linked dataset, denominator, sample, or methodology. Search Intelligence uses thresholds to call rates excellent, typical, or low, then recommends particular actions without establishing the cause.

**Plan:** display numerator/denominator, observation window, missing data, and pending outcomes. Remove or clearly qualify fixed benchmarks until an auditable, relevant source exists. Do not prescribe negotiation prep because a small sample shows low interview conversion. Offer a diagnostic review first.

### 4.7 Time definitions do not consistently follow user settings

The analytics service uses the execution environment's date/time and a Sunday week boundary without reading the stored user timezone. It mixes date-only parsing, local construction, and UTC date strings. Momentum compares the current partial week to complete prior weeks. Monthly outcomes follow the application cohort's current status, not event occurrence.

**Plan:** one documented user-local date/week contract shared by UI, exports, reminders, and recommendations. Offer a week-start preference. Distinguish cohort outcomes from events this month. Compare Monday-to-Tuesday with Monday-to-Tuesday, not an entire earlier week. Reject invalid/future actual-applied dates; saved jobs can have future deadlines instead.

### 4.8 Supported statuses and analytics assumptions disagree

E5's editable statuses and repository enum migrations support Applied, Phone Screen, Interview, Offer, Rejected, Withdrawn, and Ghosted. Several dashboard/timeline calculations and tests also assume Accepted and In Review. Rendering those labels is not the same as allowing a real user to record them.

**Plan:** agree one lifecycle across schema, validation, forms, imports, ChatGPT integration, exports, and analytics. Add Saved/Preparing before submission and a real acceptance/closure path. Preserve existing records and distinguish a stage from its eventual outcome. Avoid turning the pipeline into dozens of mandatory statuses.

### 4.9 Failure can look like a clean or empty search

E1 substitutes zero/empty analytics if the service fails. E2 does not surface interview/reminder query errors to the page. A failure may present as no interviews, no work, or a new account.

**Plan:** separate loading, true empty, incomplete, stale, and failed states. Keep last-known summaries where safe, show freshness and retry, and never replace failed reads with confident zero claims.

### 4.10 Long-term history is vulnerable to truncation

E2 reads applications without pagination or database aggregation; repository configuration has `max_rows = 1000`. Unpaginated reads also appear in other full-history paths. Actual deployed limits need verification, but this is a clear scale risk for the long-term-use idea.

**Plan:** authoritative database aggregates or complete bounded pagination, exact totals, and efficient recent-role queries. Validate with more than 1,000 applications. Avoid transferring every full JD/notes record just to render five recent applications.

### 4.11 Existing AI context needs a data-contract audit

E9's reminder query requests `due_date` and `notes`; repository schema uses `remind_at` and `description`. Its salary query also requests fields such as `offer_deadline`, `benefits`, and `notes` that are not present in the inspected salary migrations. Query errors are not retained in that parallel destructuring. Application context omits fields important to this proposed planner, including source, company tier, JD, referral flag, and ATS score in the primary select.

**Plan:** verify the deployed schema and correct the source contract before promising a coach with full search context. Supply structured, complete summaries with completeness warnings. Semantic retrieval can find relevant records, but does not guarantee complete counts or a reliable funnel. NESTAi should explain approved calculations rather than calculate metrics from whichever snippets were retrieved.

## 5. Walkthrough from the job seeker's perspective

These are hypothetical personas and situations, not observations from real account data.

| User situation | What is already helpful | What still gets in the way | Useful behavior to design |
|---|---|---|---|
| First day, no applications | First-application entry points, import options, approachable mobile home. | Onboarding explains tools but does not establish availability, target role, or a first concrete task. Many empty charts offer little guidance. | Save/import one job, establish a small time budget, choose the next step, and show a simple first-week plan. |
| Employed user with 30 minutes today | Mobile quick actions and recent-role access. | No plan constrained to 30 minutes; shortcuts require the user to decide everything. | Ask or remember Today's available time; present one achievable priority and why. |
| Six weeks of applications with few screens | Source, funnel, and history could help diagnose. | Current rates can mislead; generic apply-more advice does not identify targeting/materials/channel problems. | Review comparable mature cohorts, propose one small change, and agree a follow-up review. |
| Interview tomorrow plus overdue follow-up | Interview information, reminders, prep tools. | Due work is split across pages and overdue items are absent from home. | Interview-specific prep packet and an honest urgent queue; rebalance application targets. |
| Many interviews but no offer yet | STAR bank, question log, mocks, preparation tracker. | Conversion excludes rejected interviewees and counts pending cases as non-offers; prep counts are not evidence of readiness. | Capture optional round feedback and schedule practice aligned to the actual interview type. |
| International candidate | Sponsorship field, work-authorization settings, conditional banners. | Candidate sponsorship need and employer willingness are different; computed legal timelines can imply certainty. | Track known/unknown employer support with evidence, confirmed personal dates, and official resources. |
| Hundreds of applications over months | Search, filters, list pagination, exports, history. | Analytics row caps, stale records, duplicated charts, and rising maintenance burden. | Reliable full-history totals, search campaigns, bulk status review, automatic capture, and archive views. |
| Comparing two offers | Compensation comparison and weighted decision helper. | Daily dashboard does not focus on offer deadlines or the user's own priorities. | Put decisions due soon at the top; compare user-defined tradeoffs and show unresolved questions. |
| Returns after a two-week break | Stored records and reminders. | Falling momentum and expired streaks can feel punitive; old tasks may overwhelm. | A restart mode: review active roles, dismiss irrelevant tasks, and choose a smaller plan. |
| Gets a job | Offer UI and portfolio/document tools. | No fully supported accepted endpoint in the canonical status contract. | Record acceptance, pause search automation, archive the campaign, preserve useful history, and export. |

Jobnest should support more than SWE eventually. Its present company tiers, coding/system-design prep, and salary/funnel references lean toward US junior software roles. Start by making that audience's core workflow excellent; use role-aware optional modules so broadening later does not impose SWE assumptions on nurses, marketers, senior managers, or other users.

## 6. Missing capabilities ranked by user value

P0 = correctness and trust prerequisite. P1 = core usefulness. P2 = differentiation after the core is working. Effort is relative and should be estimated after design; this is not a delivery-date commitment.

| Priority | Capability | Why it matters | First useful scope | Effort / dependencies |
|---|---|---|---|---|
| P0 | Reliable events, definitions, errors, and exact counts | Users must trust the information behind their decisions. | Repair sections 4.1-4.11; publish metric definitions and coverage. | Medium-high; foundation for all advice. |
| P1 | Unified Next actions queue | Prevents missed tasks and turns the dashboard into daily help. | Overdue, today, interview prep, assessment due, offer decision; direct role links, snooze, dismiss, complete. | Medium; valid due dates/counts. |
| P1 | Saved/Preparing/Applied workflow | People discover and prepare jobs before submitting them. Counting every saved role as applied corrupts goals and analytics. | Separate saved date from actual application date; application deadline and submitted confirmation. | Medium; canonical lifecycle. |
| P1 | Availability and preferences around the existing goal | A useful plan needs realistic capacity and relevant opportunities. | Keep current weekly application goal; add weekly minutes/preferred days, optional role/level and location/work-mode preferences. | Medium; extend existing settings, no second goal. |
| P1 | Weekly planner with adaptive task mix | Turns the existing target into achievable daily actions across applications, follow-ups, networking, and preparation. | Distribute remaining applications from the current goal; add relevant supporting tasks, capacity checks, reasons, weekly review. | Medium-high; queue, existing goal, events. |
| P1 | Fast capture and trustworthy deduplication | Manual re-entry makes a tracker less useful than a spreadsheet. Incomplete capture also weakens personalization. | Improve existing URL/text/CSV/ChatGPT capture; propose duplicates using job ID/canonical URL and user confirmation. | Medium; preserve distinct requisitions. |
| P1 | Browser capture | Meets users where they discover/apply for jobs. | Save posting and JD snapshot with review; mark applied separately; supported-site fallback. Start one browser. | High; lifecycle/import contract first. |
| P1 | User priorities and transparent suitability | Helps users choose among opportunities with limited time. | Interest, deal-breakers, known fit factors, salary/work mode, deadline; editable shortlist. | Medium; distinguish missing from failing. |
| P1 | Stage-specific actions and context | Eliminates navigation between loosely connected tools. | From one role: selected resume, match edits, contact, follow-up draft, next interview prep, debrief. | Medium; reuse existing tools. |
| P1 | Cross-device preparation/task state | Users start work on a laptop and check it on a phone. | Persist tailoring items, task completion, and plan state server-side. | Medium; current checklist is localStorage-only. |
| P1 | Campaigns and archive/pause | Long-term histories mix different searches and life stages. | Active search goal, archive closed roles, restart campaign, pause reminders. | Medium; reporting filters and lifecycle. |
| P2 | Email-assisted status reconciliation | Updating status is recurring work and a major source of stale data. | User forwards/selects job emails; propose matched status/date changes for review. Start narrow before mailbox access. | High; matching quality and consent. |
| P2 | Calendar connection | Prevents scheduling conflicts and makes plans practical. | Calendar export first; optional read availability/write chosen events later, with timezone handling. | Medium-high; calendars must not block manual use. |
| P2 | Resume-version outcome comparison | Answers Which materials are producing screens? | Immutable submitted-version links and comparable-cohort outcomes. | Medium-high; retention policy and event quality. |
| P2 | Interview feedback and preparation diagnosis | Makes preparation more focused than generic practice. | Optional debrief, round/type, observed feedback, next practice task; no invented rejection reasons. | Medium; stage history. |
| P2 | Weekly learning review | Turns analytics into a small strategy adjustment. | What progressed, what remains unresolved, one experiment, next week's capacity. | Medium; planner and reliable cohorts. |
| P2 | Application autofill and answer library | Saves repetitive work at employer portals. | Reusable verified profile/answers, selected resume, user review before submission; supported-site diagnostics. | High; extension/profile accuracy. |
| P2 | Selective job discovery | A planner needs suitable opportunities to schedule. | Saved search links and bring-your-own listings initially; licensed/approved feeds later. | High for broad coverage; avoid becoming an unfocused job-board clone. |

Accessibility, mobile parity, data portability, and clear failure/recovery states are release criteria across these capabilities, not extras at the end.

## 7. What to reduce, reposition, or redesign

### Reduce dashboard clutter

Move monthly, company-count, tier, and salary-by-source charts to Insights or their relevant workspace. Merge repeated velocity displays and repeated source advice. Default home should answer today's questions; an interested user can explore the evidence behind them.

Do not remove useful tools just because they are occasional. Salary comparison can be extremely valuable for a user with offers and irrelevant for a new user. Show it when it helps that user's current stage.

### Replace completeness scoring with appropriate readiness

E10 gives equal credit for resume, cover letter, JD, salary range, URL, location, source, notes, job ID, and ATS scan. This measures filled fields, not application quality. A role with no published salary or required cover letter can be valid without a 100% score.

Replace one universal score with:

- Required information missing: enough to capture the role or complete the application.
- Useful tracking context: optional information that improves later review.
- Role-specific preparation: verified resume selection, any required materials, and genuine unresolved fit questions.

Do not reward adding filler notes, running repeated scans, or generating unnecessary cover letters simply to fill a meter.

### Make tailoring actionable and truthful

The existing checklist generator reads the JD, company, and position but not the user's resume (E10). It can extract employer priorities; it cannot reliably identify what is missing from that candidate's materials.

Offer a selected-resume comparison with evidence from both documents. Explain which claims already have support and which need the user's input. Persist completed edits and scan history. Never invent skills or experience. Show a few high-impact edits instead of requiring the user to satisfy an arbitrary number of tips.

### Preserve material history by default

The existing 30-day document purge after rejection has notifications and a retain option (E12). However, a rejected-role resume may be useful for a reopened role, future search, or material comparison. Removing it also undermines long-term learning.

Reconsider default automatic purge. Prefer archive/storage management chosen by the user, a clear retention policy, and immutable submitted-version references while retained. Keep the user's deletion control. If documents are removed, do not present broken links or imply the exact submitted materials remain available.

### Use preparation progress honestly

Prep rings count completed items or drafted STAR fields (E13). They help track practice, but completion is not validated interview readiness. Label what was completed; use role/round-specific practice and optional feedback instead of asserting a readiness score from counts. Make rest and pause compatible with progress.

### Replace generic pressure with useful context

More applications this week is not always better. Interviews, assessments, targeted networking, or a deliberate break can be the right use of time. Avoid unconditional push-harder and you're-close claims. Explain a concrete action the user controls and let them choose a sustainable pace.

### Treat specialized deadlines as a distinct responsibility

The H-1B card hardcodes a season label while counting down to a recurring April 1. The OPT banner derives expiry from a start date and extension flag (E14). These are product assumptions requiring expert review, not verified individual timelines. Replace derived certainty with confirmed dates, source/freshness, and maintained official resources. This plan does not provide immigration advice.

## 8. Proposed dashboard experience

### Home: the everyday workspace

Suggested order on desktop and mobile:

1. **Next actions:** a few specific tasks with the associated role, due date, expected minutes, and direct action. Separate urgent commitments from optional suggestions.
2. **This week's plan:** completed/planned actions, remaining time, next scheduled block, and Edit plan.
3. **Pipeline that needs attention:** upcoming conversations, stale records to review, and decisions due soon. Show exact counts with preview lists.
4. **Recent changes:** newly applied roles, status changes, recruiter replies, scheduled interviews, and completed work.
5. **One useful insight:** a claim supported by a stated cohort and sample, its practical implication, and a way to inspect the underlying records.

Keep Add role easy to reach. Display a true new-user setup instead of a wall of zeros. For users with substantial records but stale outcomes, prioritize reconciliation before recommendations.

### Insights: answer a question, then show evidence

Provide questions such as:

- Where are my applications progressing or stopping?
- Which sources bring suitable screens or interviews?
- Which resume versions have usable comparison data?
- How long do responses take in the records I have updated?
- How does my schedule fit my available time?

Use a consistent active-campaign/date/role/source filter. Each chart needs a definition, sample, pending/unknown counts, freshness, drill-down, and an action when justified. Include an accessible table; do not rely on color or hover-only tooltips. Keep mobile access explicit.

### Plan: execution and review

The plan is a saved set of editable tasks, not only a chat answer. Users can accept, reschedule, skip, reduce capacity, replace a task, or pause it. Explain why it changed after an interview or new deadline. Notifications follow their chosen hours and preferences.

## 9. Personalized planning: evaluation of the user's suggestion

### What should the planner optimize?

Help the user use their available time on suitable opportunities and necessary commitments. Optimize useful progress and reduced administrative work. Raw application volume is an incomplete objective and can encourage low-fit submissions.

Distinguish:

- **Outcome goal:** a suitable job, offer, or interviews by a desired date. The app can assist but cannot guarantee it.
- **Controllable targets:** applications to selected roles, planned outreach, preparation sessions, and timely follow-ups.
- **Capacity:** weekly minutes, days available, interview commitments, and practical energy limits.

An outcome target can guide scenario planning; it should not be mechanically converted into a precise number of applications that promises success.

### Reuse the existing weekly goal as the planner's starting point

The existing value is stored in `user_metadata.weekly_goal`, edited through Profile and Weekly Cadence, and saved through `/api/profile/update-weekly-goal`. The current validation is an integer from 1 to 100, with a displayed fallback of five when unset (E4, E7). Preserve that goal contract. A plan's saved snapshot may record which goal it used, but must not become an independent editable application target.

- Read the saved weekly goal and the corrected current-week confirmed-application count.
- Remaining applications = the greater of zero and weekly goal minus confirmed applications this week.
- Allocate those remaining applications across the user's remaining available days, with realistic task durations and suitable-role availability.
- Count each confirmed application once. Saved roles, drafts, ATS scans, and reminder completion do not satisfy the application target.
- Keep networking, follow-ups, and prep visible as supporting work with their own task progress. They do not inflate application-goal completion.
- If the user changes the goal in Profile, dashboard, or planner, use the same existing save path and refresh every view. A failed save must not leave a new target appearing authoritative in one view.
- If the plan exceeds available time, show the gap and choices. An explicitly accepted goal change uses the existing goal setting; the planner never changes it automatically.
- If the goal is met, stop suggesting catch-up applications. Continue urgent commitments and offer optional work without escalating the target.
- Pausing a search preserves the existing goal. Missed work does not automatically accumulate into a larger next-week quota.

Example: weekly goal eight, three already submitted, and three available days remaining means schedule five more, such as two, two, and one. Do not schedule eight new applications. If capacity only supports three, show a two-application shortfall and let the user adjust time, plan, or the existing goal.

### Data already available

| Existing data | Useful planning application | Important limit |
|---|---|---|
| Applied date and current status | Application pace, weekday activity, active-search review. | Day precision only; current status cannot recover the entire journey. |
| Status-change activity logs | Approximate stage history and first observed progression. | Log time usually means when the user recorded it, not necessarily when the employer acted. Imports can start in later stages. |
| Company, role, location, JD, source, tier | Targeting, source/role breakdowns, prep context. | Free text/optional fields need normalization; one source does not capture both discovery and submission channel. |
| ATS score and application documents | Connect a material review to a role. | Latest score is not scan history or hiring probability; current document is not necessarily submitted document. |
| Interviews and schedules | Reserve preparation time and prioritize imminent commitments. | Must reconcile cancellations, rounds, status, and timezone. |
| Reminders and completed_at | Required actions and recorded follow-through. | Completing a reminder does not prove an email was sent or read. |
| Contacts, referrals, last_contacted_at, coffee chats | Plan relationship work and referral follow-up. | Contact/outreach confirmation and real referral state matter more than a flag. |
| Prep problems, mocks, STAR answers, assessments | Schedule relevant practice and assessment work. | Preparation counts are weak proxies for readiness; assessment time fields do not provide general application time cost. |
| Weekly application goal and connection goal | Reuse existing accountability targets. | They do not define availability, role suitability, desired outcome, or sustainable task mix. |
| Profile/education/skills and NESTAi free-text context | Personal context and role-specific help. | Free text is not a verified structured plan or a complete goal contract. |
| Compensation records | Enforce user preferences and compare offers. | Normalize currency/pay period; separate advertised range, expectation, and actual offer. |

### Data to add, progressively

Start by reading the existing weekly goal. Add a lightweight availability choice and optional search focus; infer proposed working days from reliable habits where possible and ask the user to confirm them. Ask for other details when they unlock a useful decision.

- Search campaign and optional outcome preferences around the existing weekly goal: target date, success criteria, work modes/locations, pay preferences, and deal-breakers. Do not create a duplicate weekly application goal.
- Saved/preparing/submitted dates, deadline, posting date when available, actual timestamp only when known, and timezone.
- Events with `occurred_at` versus `recorded_at`, date precision, source, and confirmation state. Relevant types: employer reply, stage reached, offer received, acceptance/closure, and follow-up sent.
- Optional time estimates/actual minutes for application, preparation, follow-up, and networking. A timer must not be mandatory.
- Interest/priority and fit evidence; separate candidate sponsorship need from known employer policy.
- Submitted document-version snapshot and scan version/date.
- Plan/recommendation shown, accepted/edited/dismissed, task result, and optional reason. Collect only what is needed to evaluate usefulness.

Do not infer actual submission hour from record creation time. Import time, logging time, and application time are different.

### Stage A: useful planning from day one

Use simple scheduling rules before historical outcome recommendations:

1. Read the existing weekly goal and calculate remaining applications after this week's confirmed submissions.
2. Establish available minutes and remaining working days.
3. Reserve time for imminent interviews, assessments, and offer decisions.
4. Add due follow-ups only where they are appropriate and actionable.
5. Choose user-prioritized suitable saved roles; allocate realistic preparation/application time toward the remaining goal.
6. Include networking and targeted practice based on the current pipeline.
7. Keep task minutes within available capacity and leave explicit room for uncertainty; surface any shortfall against the existing goal.
8. Show the plan for editing and acceptance. Create no external messages or applications automatically.
9. Review execution weekly and learn task-duration preferences.

These rules should be testable and understandable. The existing NESTAi interface can explain the schedule and help with individual tasks, but the schedule and arithmetic should come from a structured planning service.

### Stage B: personalization from reliable personal history

As the user records enough recent, comparable activity:

- Learn realistic task durations and preferred completion windows.
- Adjust task mix when interview commitments increase or saved-role inventory is low.
- Compare recent sources/role types using positive progression, usable sample sizes, observation horizons, and uncertainty.
- Flag record gaps and ask for a short status review when those gaps prevent good advice.
- Suggest a small, reversible experiment rather than make a sweeping strategy change.

Example wording: You usually complete application tasks on Tuesday and Thursday. Schedule two blocks there? That is a habit-based scheduling suggestion, not a claim that employers favor those days.

If outcome evidence is weak, say so and keep the availability-based plan. Do not unlock strong advice merely after 30 days, three months, or a fixed lifetime application total.

### Stage C: introduce ML only after it beats the baseline

Possible later uses:

| Use | Why ML might help | Start with |
|---|---|---|
| Task duration estimation | Better capacity planning than one fixed estimate for everyone. | Personal observed medians; later a simple duration model using known task attributes. |
| Task completion likelihood | Suggest feasible blocks the user will actually use. | Preferences and completion history; later a simple interpretable model. |
| Comparable opportunity/source ranking | Many factors may interact beyond a few rules. | Explicit user fit and observed cohort summaries; later calibrated progression models with user control. |
| Time-to-response estimates | Waiting applications have incomplete outcomes. | Empirical observed distributions; evaluate survival methods if censoring needs justify them. |
| Weekly task allocation | Different searches need different mixes of sourcing, prep, and follow-through. | Transparent rules; later evidence-informed ranking constrained by goals and capacity. |

Do not build a neural network per individual just because they have used Jobnest for months. Each user's dataset may remain too small or have very few positive outcomes. Evaluate simple models first. Any cross-user learning is a separate consent/data-governance decision; personal assistance must work without it.

This staged approach follows the general principles of starting with metrics and a simple baseline before ML. [Google's Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml)

### The particular question: which day and how many applications?

Give a credible answer in layers:

1. **When the user can work:** known availability and preferred days.
2. **When they tend to follow through:** confirmed task execution history.
3. **Which actions matter now:** deadlines, interviews, suitable-role inventory, and due work.
4. **Whether historical outcomes vary by day:** descriptive comparison only after reliable comparable records exist.

Show an example of why volume is insufficient: Tuesday has 30 applications and 3 screens; Friday has 10 and 2. Tuesday has more screens, Friday has the larger raw rate, and neither proves the weekday caused the outcome. Small samples, role/source differences, and recent applications still awaiting outcomes can overturn the comparison.

Use the existing weekly goal to determine how many applications remain. Capacity determines whether that target fits: available application minutes divided by a realistic duration estimate, also bounded by suitable saved roles. If remaining target exceeds capacity, show the shortfall and choices: more time, rescheduled supporting work where appropriate, or a user-approved edit to the existing goal. Do not silently replace the target with the capacity estimate or overload the week.

### Example weekly plan

Illustrative only; these are invented preferences and tasks, not findings about an actual user. Assume an existing weekly goal of eight, zero submissions so far this week, 360 available minutes, eight suitable saved roles, an agreed 25-minute application estimate, and no conflicting urgent interview.

| Day | Actions | Minutes |
|---|---|---:|
| Monday | Apply to 2 selected roles, send 1 reviewed outreach, check priorities. | 70 |
| Tuesday | Apply to 2 selected roles, complete 1 due follow-up. | 60 |
| Wednesday | 60-minute role-specific preparation, 1 reviewed outreach. | 70 |
| Thursday | Apply to 2 selected roles, complete 1 due follow-up. | 60 |
| Friday | Apply to 2 selected roles, 1 outreach, 30 minutes of preparation, weekly review. | 100 |
| Total | 8 applications, 3 outreach actions, 2 follow-ups, 90 minutes of preparation, 20 minutes of planning/review. | 360 |

Explain the basis: this fits the user's availability and priorities. It is not a prediction of an offer. If task estimates are uncertain, propose a smaller initial plan with buffer. If an interview arrives, reserve prep time and visibly reduce or reschedule application work. If there are only three suitable saved roles, add sourcing time rather than manufacture five application tasks.

### Recommendation contract

Every recommendation should include:

- Specific action, role/contact when relevant, suggested date/block, and expected minutes.
- Reason: deadline, preference, habit, or observed outcome pattern.
- Supporting window/sample and a link to the records, where historical evidence is used.
- Known uncertainty, missing context, and any freshness limit.
- Accept, edit, dismiss, snooze, and Why this? controls.

Store accepted plans and revisions. Refresh on meaningful events and the weekly review, without quietly replacing accepted tasks. Avoid repeated notifications for dismissed suggestions.

## 10. Measurement rules and ML evaluation

### Shared metric definitions

| Metric | Proposed meaning |
|---|---|
| Applications submitted | Confirmed submitted applications in the chosen campaign/window; excludes saved/preparing roles. |
| Active applications | Open submitted records; distinguish waiting applications from active conversations. |
| Any reply rate | Applications with an explicitly recorded employer reply divided by the applicable cohort; count rejection replies, exclude automated receipt confirmations or show them separately. |
| Positive progression rate | Applications with a confirmed invitation/progression event; do not count rejection as success. |
| Stage reached | Distinct applications with evidence they entered the stage, irrespective of eventual closure. Report unknown/skipped stages separately. |
| Interview-to-offer | Offers after verified interview entry, with resolved/pending cases separated and a stated observation horizon. Do not treat all pending interviews as failures. |
| Response time | Time from actual application to first qualifying employer reply. Preserve same-day responses and event precision. |
| No response / needs review | No known qualifying response within a stated review window, distinguished from user-confirmed Ghosted and incomplete updates. |
| Source effectiveness | Positive progression for comparable application cohorts, with sample, unknown/pending outcomes, and relevant time cost. |
| Momentum | Change against equal elapsed periods, interpreted alongside task mix and capacity. |
| Task success | User-confirmed useful action; reminder completion and message transmission are separate facts. |

Never present an ATS score, completion score, response prediction, or weekday correlation as a probability of getting hired.

### Evaluation before predictive rollout

1. Define labels, observation horizons, missing-data handling, and feature availability at recommendation time.
2. Keep unresolved recent applications pending. Avoid selecting only clean or successful histories. Treat late replies and reopened roles explicitly.
3. Build chronological train/validation/test windows. Also hold out users/companies where necessary to test generalization; keep related rows together. Exclude future outcome/status fields and later document edits from historical features.
4. Compare against availability-only scheduling, explicit user priorities, and simple recent-rate/duration baselines.
5. Evaluate calibration and uncertainty, not only classification accuracy or ranking. For probability-based outputs, use calibration curves and appropriate scoring alongside discrimination. [scikit-learn calibration guidance](https://scikit-learn.org/stable/modules/calibration.html)
6. Evaluate delayed outcomes with a consistent horizon and time-aware methods. Split design must reflect temporal and grouped data rather than assume every row is independent. [scikit-learn cross-validation guidance](https://scikit-learn.org/stable/modules/cross_validation.html)
7. Run shadow recommendations, then a small opt-in pilot with user feedback. Randomize at user/campaign level when measuring planner impact; do not credit the planner with every change in job-market outcomes.
8. Predefine a meaningful improvement threshold and power/sample requirements from observed baseline data. There is no universal minimum application count that guarantees useful ML.
9. Monitor drift, segment performance, dismissals, inappropriate deadlines, capacity violations, and missingness. Roll back to the simple planner when performance or evidence deteriorates.

Prediction does not prove a suggested behavior causes better outcomes. To claim that following a plan improves results, evaluate the intervention itself. Keep exploratory recommendations modest and do not force users away from their priorities.

### Data controls

Use only the user's chosen information for their personal plan. Separate optional pooled learning from ordinary tracking and AI assistance. Do not use protected or highly sensitive attributes to infer employability or recommend lowering aspirations. User-stated requirements can inform explicit constraints without becoming hidden quality scores.

Retain provenance and correction history for recommendations, minimize training inputs, respect deletion/retention choices, and keep private resume/contact content out of shared evidence. Explain what data contributed to a recommendation and let the user opt out.

## 11. Competitive baseline and intended advantage

Checked against official product documentation on October 6, 2026. These are vendor-described capabilities, not independently tested performance or a complete market ranking.

| Platform | Relevant documented capabilities | Implication for Jobnest |
|---|---|---|
| Teal | Browser job saving, bookmarked/applying/submitted stages, interest ratings, stage guidance, contacts, resume attachments. | Saved-before-applied workflow and contextual guidance are baseline expectations. [Teal tracker guide](https://help.tealhq.com/en/articles/14435727-how-to-track-your-job-applications) |
| Huntr | Browser capture with editable extracted details, saved stages, profile-based application autofill. | Good capture and correction flow must compete with manual-entry alternatives. [Huntr extension guide](https://help.huntr.co/en/articles/9859408-the-huntr-chrome-extension) |
| Simplify | Autofill, reuse of unique-question answers, selected resume/cover-letter assistance, and automatic application tracking after submission. | Administrative time savings deserve priority alongside coaching. [Simplify Copilot guide](https://help.simplify.jobs/help/articles/2415391-using-copilot-to-autofill-applications) |

Proposed advantage: one reliable history that powers personalized, feasible next actions across applications, networking, documents, and interview preparation, with visible evidence and easy correction. This is a strategic hypothesis to test, not a claim that competitors lack planning or that Jobnest is already best.

Do not pursue every competitor feature simultaneously. First prove users repeatedly prefer Jobnest for the complete daily workflow; then deepen capture, planning, and relevant integrations.

## 12. Delivery roadmap and acceptance criteria

### Phase 0: validate workflows and settle definitions

Deliverables: metric dictionary, canonical lifecycle, target-user definition, current workflow map, short usability study, and prioritized designs. Recruit users with little history, mature history, time constraints, interviews, and sponsorship needs; include mobile and keyboard/assistive-technology users. A small formative study can find friction, but cannot establish market leadership or outcome improvement.

Ask participants to complete concrete tasks: capture a job, distinguish saved from submitted, find overdue work, choose today's action, prepare for a specific interview, interpret a source chart, and restart after a break. Observe actions and uncertainty, not only feature requests. Review existing authorized usage/support evidence where available.

Exit criteria: agreed denominators/date rules; users' top daily problems documented; prototype changes address observed failures; live schema/deployment assumptions verified.

### Phase 1: trust and urgent-work foundation

Deliverables: corrected analytics, event/date contract, exact counts, proper error states, consistent status support, future/overdue tasks, complete-history aggregation, and document-retention decision.

Acceptance scenarios:

- Applied -> Interview -> Rejected retains its observed application/interview history.
- Editing notes after a reply does not change response time.
- Same-day reply remains usable; unknown dates remain visibly unknown.
- Withdrawn after a reply preserves the reply event; withdrawn before a reply does not invent one.
- A declined/closed offer remains in historically received offers when the event is known.
- Overdue-only reminders never produce No pending reminders.
- Seven scheduled interviews show an exact count of seven with a limited preview.
- Current-week comparisons use matching elapsed days and chosen timezone/week start.
- 1,500 application records yield complete totals and accurate campaign filters.
- A query failure does not display zero as if verified.
- Unsupported statuses/fields cannot silently create a false pipeline or incomplete AI context.
- Corrected definitions match in dashboard, reports, and coach context.

### Phase 2: useful home and connected role workflow

Deliverables: Next actions, improved recent changes, home/Insights separation, mobile access parity, role-specific deep links, server-persisted task/checklist state, and concise new-user setup.

Acceptance: a user can identify and open today's highest-priority commitment quickly; tasks can be completed, snoozed, dismissed, and corrected across devices. A role links the submitted materials, contact, stage history, and preparation. Deeper analytics are accessible without crowding home. Accessibility and low-data/error states are verified in the actual UI.

### Phase 3: capacity-based planner

Deliverables: planner integration with the existing weekly goal and save endpoint, availability/preferences, saved/preparing workflow, deterministic schedule, editable task estimates, weekly review, and notification preferences.

Acceptance: the existing goal remains synchronized across Profile, dashboard, and planner; already-submitted applications reduce remaining planned work; a goal edit refreshes the plan without duplicating tasks; prep/networking never count as submitted applications. Planned time fits availability; shortfalls are explicit and never cause an automatic goal change; urgent commitments override optional work; insufficient saved roles creates sourcing work; a new interview causes an explained revision; paused users receive no catch-up avalanche. Planning remains usable when AI is unavailable. No task promises an offer or automatically submits messages/applications.

### Phase 4: reduce administration and learn from history

Deliverables: browser capture, improved deduplication/import reconciliation, immutable submitted versions, evidence-backed descriptive insights, and optional email/calendar pilots. Autofill can follow once profile accuracy and supported-site capture are dependable.

Acceptance: users can capture/correct common postings quickly, keep distinct requisitions distinct, review proposed email changes, and disconnect integrations. Historical comparisons expose pending/unknown records. Measure saved time and correction rate, not just successful API requests.

### Phase 5: measured ML pilot

Deliverables: quality-reviewed training data, baseline comparisons, temporal/group validation, calibrated models where appropriate, shadow evaluation, opt-in pilot, explanation and rollback.

Acceptance: measurable user benefit over the simple planner at predefined thresholds; acceptable segment performance; no leakage or capacity/deadline violations; low-evidence fallback remains useful. If these gates fail, continue with the simpler planner and improve data quality.

## 13. How to know the platform is becoming more useful

Set baselines before numerical targets. Candidate metrics:

| Dimension | Measure | Interpretation |
|---|---|---|
| Immediate usefulness | Time to first useful action after landing on home; task completion without searching across pages. | Tests whether the dashboard helps act. |
| Tracking effort | Median capture/update time; user-reported admin minutes saved; import/auto-capture correction rate. | Measures relief from repetitive work. |
| Trust | Completeness of confirmed events; stale-status rate; discrepancy/error reports; users' ability to explain a metric. | Measures whether recommendations have a sound foundation. |
| Execution | User-selected tasks completed by agreed due date; capacity adherence; snooze/dismiss reasons. | Usefulness of the plan, without rewarding excessive work. |
| Search progress | Comparable-cohort positive screens/interviews, time to progression, optional self-reported accepted suitable job. | Meaningful outcomes, affected by external conditions and reporting gaps. |
| Sustainability | Perceived overwhelm, pauses respected, burden of updates, plan usefulness after a restart. | A plan should remain feasible during difficult periods. |
| Continued preference | Repeat weekly reviews and active-campaign return, with explicit successful-search completion recorded. | Retention during a search is useful; leaving because the user found a job can be success. |

Avoid making application count, AI token usage, chart views, streaks, or lifetime retention the main success criterion. Pair every outcome rate with its denominator, campaign, observation horizon, and completeness.

## 14. Risks, tradeoffs, and decisions to validate

| Risk or decision | Proposed handling |
|---|---|
| Broad audience versus current SWE orientation | Start with the existing audience while making prep, benchmarks, and company segmentation optional and role-aware. Validate expansion separately. |
| More personalization versus more setup | Progressive questions; a useful minimal plan before comprehensive profiling. |
| Recommendations based on stale/manual data | Short reconciliation prompts, provenance, coverage, and uncertainty. Missing updates are not confirmed failures. |
| Too many automated follow-ups | Base cadence on actual application/last contact/promised response dates, user preferences, and actionable contacts. Do not create duplicate or irrelevant prompts. |
| Existing cadence uses record creation date | Re-anchor to actual applied date or meaningful contact. Imports should not start a fresh misleading follow-up clock. |
| Urgency versus pressure | Protect commitments, offer capacity reduction/rest, and avoid punitive missed-goal language. |
| Good user outcome versus long-term engagement | Record accepted jobs and pause/close searches. Do not optimize for keeping someone job hunting indefinitely. |
| Model advice versus user preferences | Preferences and constraints remain authoritative; uncertainty cannot be disguised by fluent AI explanations. |
| Fragile third-party capture | Supported-site scope, review, fallback capture, correction metrics, and maintenance ownership. |
| Legal/compensation references becoming stale | Dated attributable sources, confirmed personal records, scoped estimates, and expert review of specialized guidance. |
| Cost and packaging | Measure task-level AI cost; keep basic tracking, plan editing, and truthful metrics dependable. Validate paid advanced features without undermining the core. |

Recommended first implementation batch when coding is separately authorized: fix overdue/exact counts, correct the event-based funnel/response definitions, make failures explicit, and expose a single Next actions area. Then build the saved-role lifecycle and turn the existing weekly goal into a capacity-aware daily plan. These improvements provide a concrete path toward a highly useful platform and give later ML a trustworthy base.
