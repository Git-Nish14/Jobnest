import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nestaAiSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractAllDocuments } from "@/lib/utils/document-parser";

// Rate limits per plan
const RATE_LIMITS = {
  free: { maxRequests: 5,  windowMs: 60_000 },
  pro:  { maxRequests: 30, windowMs: 60_000 },
} as const;

// ── Document parse cache (5-minute TTL) ─────────────────────────────────────
// Uses Upstash Redis when configured, falls back to in-memory Map.
// Redis survives cold starts and is shared across all function instances.
const DOC_CACHE_TTL_SECONDS = 5 * 60;
const DOC_CACHE_TTL_MS = DOC_CACHE_TTL_SECONDS * 1000;

type DocTexts = Awaited<ReturnType<typeof extractAllDocuments>>;

// ── In-memory fallback ────────────────────────────────────────────────────────
interface MemEntry { texts: DocTexts; parsedAt: number; }
const memDocCache = new Map<string, MemEntry>();

function memGetDocCache(userId: string): DocTexts | null {
  const entry = memDocCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.parsedAt > DOC_CACHE_TTL_MS) { memDocCache.delete(userId); return null; }
  return entry.texts;
}
function memSetDocCache(userId: string, texts: DocTexts): void {
  memDocCache.set(userId, { texts, parsedAt: Date.now() });
  if (Math.random() < 0.05) {
    const cutoff = Date.now() - DOC_CACHE_TTL_MS;
    for (const [k, v] of memDocCache) { if (v.parsedAt < cutoff) memDocCache.delete(k); }
  }
}

// ── Redis helpers ─────────────────────────────────────────────────────────────
function isDocCacheRedisReady() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisGet(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const json = await res.json();
  return json.result ?? null;
}

async function redisSetEx(key: string, ttlSec: number, value: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  await fetch(`${url}/setex/${encodeURIComponent(key)}/${ttlSec}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

// ── Public cache API ──────────────────────────────────────────────────────────
async function getDocCache(userId: string): Promise<DocTexts | null> {
  if (isDocCacheRedisReady()) {
    try {
      const raw = await redisGet(`doc-cache:${userId}`);
      return raw ? (JSON.parse(raw) as DocTexts) : null;
    } catch (err) {
      console.warn("[doc-cache] Redis GET error, falling back:", err);
    }
  }
  return memGetDocCache(userId);
}

async function setDocCache(userId: string, texts: DocTexts): Promise<void> {
  if (isDocCacheRedisReady()) {
    try {
      await redisSetEx(`doc-cache:${userId}`, DOC_CACHE_TTL_SECONDS, JSON.stringify(texts));
      return;
    } catch (err) {
      console.warn("[doc-cache] Redis SET error, falling back:", err);
    }
  }
  memSetDocCache(userId, texts);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    // Look up plan — runs in parallel with rate-limit check below
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPro = sub?.plan === "pro" && sub?.status === "active";
    const limits = isPro ? RATE_LIMITS.pro : RATE_LIMITS.free;

    // Rate limit check
    const rateLimit = await checkRateLimit(`nesta:${user.id}`, limits);

    if (!rateLimit.allowed) {
      const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Rate limit reached. You can send ${limits.maxRequests} messages per minute.${!isPro ? " Upgrade to Pro for 30 messages/min." : ""}`,
          resetIn: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limits.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetTime / 1000)),
          },
        }
      );
    }

    const { question, history, fileContent, fileName } = await validateBody(request, nestaAiSchema);

    // ── Fetch every piece of user data in parallel ─────────────────────────
    const [
      { data: applications },
      { data: interviews },
      { data: reminders },
      { data: contacts },
      { data: activityLogs },
      { data: emailTemplates },
    ] = await Promise.all([
      supabase
        .from("job_applications")
        .select("id, company, position, status, applied_date, location, salary_range, notes, job_url, resume_path, cover_letter_path")
        .eq("user_id", user.id)
        .order("applied_date", { ascending: false }),

      supabase
        .from("interviews")
        .select("id, type, round, status, scheduled_at, duration_minutes, location, meeting_url, interviewer_names, notes, job_applications(company, position)")
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: false }),

      supabase
        .from("reminders")
        .select("id, title, type, due_date, is_completed, notes, job_applications(company, position)")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),

      supabase
        .from("contacts")
        .select("name, company, role, email, phone, notes, is_primary, linkedin_url, application_id")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      // Full activity log — no limit
      supabase
        .from("activity_logs")
        .select("activity_type, description, created_at, job_applications(company, position)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      // User's saved email templates
      supabase
        .from("email_templates")
        .select("name, category, subject, body")
        .eq("user_id", user.id)
        .order("category", { ascending: true }),
    ]);

    // ── Fetch tags + salary details using application IDs ──────────────────
    let tags: Array<{ application_id: string; tag_name: string }> = [];
    let salaryDetails: SalaryRow[] = [];

    if (applications && applications.length > 0) {
      const appIds = applications.map((a) => a.id);

      const [{ data: tagRows }, { data: salaryRows }] = await Promise.all([
        supabase
          .from("application_tags")
          .select("application_id, tags(name)")
          .in("application_id", appIds),

        supabase
          .from("salary_details")
          .select("application_id, base_salary, bonus, signing_bonus, equity, benefits, final_offer, offer_deadline, currency, notes")
          .in("application_id", appIds),
      ]);

      if (tagRows) {
        tags = (tagRows as unknown as TagRow[]).flatMap((row) => {
          const tagName = row.tags?.name;
          return tagName ? [{ application_id: row.application_id, tag_name: tagName }] : [];
        });
      }

      if (salaryRows) {
        salaryDetails = salaryRows;
      }
    }

    // ── Extract full text from uploaded resumes & cover letters ─────────────
    // Cache per user for 5 minutes — avoids re-parsing on every message
    let documentTexts: DocTexts = [];
    if (applications && applications.length > 0) {
      const cached = await getDocCache(user.id);
      if (cached) {
        documentTexts = cached;
      } else {
        documentTexts = await extractAllDocuments(supabase, applications);
        await setDocCache(user.id, documentTexts);
      }
    }

    // Shared args for buildContext — reused across trimming passes.
    // Supabase infers joined tables (job_applications) as arrays without generated
    // DB types, so we cast the three affected arrays through unknown.
    const contextArgs = [
      applications,
      interviews as unknown as InterviewRow[] | null,
      reminders as unknown as ReminderRow[] | null,
      contacts,
      tags,
      activityLogs as unknown as ActivityRow[] | null,
      salaryDetails,
      emailTemplates,
      documentTexts,
    ] as const;

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        { error: "AI service is temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }

    // NESTAi context: use the dedicated nestai_context field if set,
    // otherwise fall back to the general about_me profile bio.
    const nestaiContext: string =
      user.user_metadata?.nestai_context ??
      user.user_metadata?.about_me ??
      "";

    const buildSystemPrompt = (context: string) =>
      `You are NESTAi, a sharp and helpful AI assistant built into Jobnest — a job application tracking platform. You have complete access to this user's job search data and must use it to give accurate, specific answers.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
${nestaiContext ? `\n=== ABOUT THIS USER ===\n${nestaiContext}\n=== END USER CONTEXT ===\n` : ""}
=== USER'S COMPLETE JOB SEARCH DATA ===
${context}
=== END OF DATA ===

Guidelines:
- Use the data above to answer accurately. Never say you don't have data if it's listed above.
- Be concise and direct. Use bullet points for lists.
- Quote specific numbers, names, companies, and dates from the data.
- Resumes and cover letters: full extracted text is included in the DOCUMENT CONTENTS section. You CAN read, quote, and summarise their content. If a document says "(Could not extract text: ...)", explain that to the user and suggest they check the file format.
- When relevant, suggest a concrete next step.
- Use conversation history for natural follow-ups.
- After your response, append EXACTLY this on a new line (replace the brackets with real questions relevant to the conversation — no extra text):
FOLLOW_UPS: [question 1?] | [question 2?] | [question 3?]`;

    // If the user attached a file, prepend its content to the user turn server-side
    // (keeps `question` within its 2000-char validation limit on the client)
    const userContent = fileContent
      ? `[Attached file: ${fileName ?? "file"}]\n${fileContent}\n\n${question}`
      : question;

    // ── Smart context trimming ─────────────────────────────────────────────
    // Build messages, progressively trimming until within the token budget.
    const totalEstTokens = (msgs: Array<{ content: string }>) =>
      msgs.reduce((sum, m) => sum + estimateTokens(m.content), 0);

    let trimmedHistory = history.slice(-100);

    const makeMessages = (ctx: string, hist: typeof trimmedHistory) => [
      { role: "system" as const, content: buildSystemPrompt(ctx) },
      ...hist,
      { role: "user" as const, content: userContent },
    ];

    let context = buildContext(...contextArgs);
    let groqMessages = makeMessages(context, trimmedHistory);

    if (totalEstTokens(groqMessages) > INPUT_TOKEN_BUDGET) {
      // Step 1 — trim history to 20 messages
      trimmedHistory = history.slice(-20);
      groqMessages = makeMessages(context, trimmedHistory);
    }

    if (totalEstTokens(groqMessages) > INPUT_TOKEN_BUDGET) {
      // Step 2 — truncate each document body to 1 000 chars
      context = buildContext(...contextArgs, { maxDocCharsEach: 1_000 });
      groqMessages = makeMessages(context, trimmedHistory);
    }

    if (totalEstTokens(groqMessages) > INPUT_TOKEN_BUDGET) {
      // Step 3 — omit doc bodies entirely, cap activity log at 20 entries
      context = buildContext(...contextArgs, { maxDocCharsEach: null, maxActivityLogs: 20 });
      groqMessages = makeMessages(context, trimmedHistory);
    }

    if (totalEstTokens(groqMessages) > INPUT_TOKEN_BUDGET) {
      // Step 4 — hard-truncate the context string itself
      const baseTokens =
        estimateTokens(buildSystemPrompt("")) +
        trimmedHistory.reduce((s, m) => s + estimateTokens(m.content), 0) +
        estimateTokens(userContent);
      const remainingChars = Math.max(500, (INPUT_TOKEN_BUDGET - baseTokens) * 4);
      context =
        context.slice(0, remainingChars) +
        "\n\n[Context truncated. Ask about specific applications or topics for full details.]";
      groqMessages = makeMessages(context, trimmedHistory);
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: groqMessages,
        temperature: 0.6,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      console.error("Groq API error:", errorData);

      if (groqResponse.status === 429) {
        return NextResponse.json(
          { error: "AI service is busy. Please wait a moment and try again." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Failed to get AI response. Please try again." },
        { status: 500 }
      );
    }

    // Stream tokens from Groq SSE → client
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body!.getReader();
        const decoder = new TextDecoder();
        let doneStreaming = false;
        try {
          while (!doneStreaming) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") { doneStreaming = true; break; }
              try {
                const json = JSON.parse(payload);
                const token = json.choices?.[0]?.delta?.content;
                if (token) controller.enqueue(encoder.encode(token));
              } catch { /* skip malformed chunks */ }
            }
          }
          // Close only once, on normal completion
          controller.close();
        } catch (err) {
          // controller.error() terminates the stream — do NOT also call close()
          controller.error(err);
        }
      },
    });

    const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset-In": String(resetInSeconds),
        "X-RateLimit-Limit": String(limits.maxRequests),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ── Token estimation ─────────────────────────────────────────────────────────

/** Rough token estimate: 1 token ≈ 4 characters (English text). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * The model's context window is 128 K tokens. We reserve 3 500 tokens for
 * the response + overhead, leaving a 124 500-token input budget.
 */
const INPUT_TOKEN_BUDGET = 124_500;

interface TrimOptions {
  maxDocCharsEach?: number | null; // undefined = full, null = skip docs, N = max chars
  maxActivityLogs?: number | null; // undefined/null = all
}

// ── Context builder — ALL data, no artificial limits ────────────────────────

/** Extract the human-readable filename from a Supabase Storage path */
function fileName(path: string | null): string | null {
  if (!path) return null;
  return path.split("/").pop() || null;
}

function fmt(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(amount: number | null, currency?: string | null) {
  currency = currency ?? "USD";
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

type AppRow = {
  id: string;
  company: string;
  position: string;
  status: string;
  applied_date: string;
  location: string | null;
  salary_range: string | null;
  notes: string | null;
  job_url: string | null;
  resume_path: string | null;
  cover_letter_path: string | null;
};
type InterviewRow = {
  id: string;
  type: string;
  round: number;
  status: string;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  meeting_url: string | null;
  interviewer_names: string[] | null;
  notes: string | null;
  job_applications: { company: string; position: string } | null;
};
type ReminderRow = {
  id: string;
  title: string;
  type: string | null;
  due_date: string;
  is_completed: boolean;
  notes: string | null;
  job_applications: { company: string; position: string } | null;
};
type ContactRow = {
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  linkedin_url: string | null;
  application_id: string | null;
};
type ActivityRow = {
  activity_type: string;
  description: string | null;
  created_at: string;
  job_applications: { company: string; position: string } | null;
};
type SalaryRow = {
  application_id: string;
  base_salary: number | null;
  bonus: number | null;
  signing_bonus: number | null;
  equity: string | null;
  benefits: string | null;
  final_offer: number | null;
  offer_deadline: string | null;
  currency: string | null;
  notes: string | null;
};
type TemplateRow = {
  name: string;
  category: string;
  subject: string;
  body: string;
};
type TagRow = { application_id: string; tags: { name: string } | null };

type DocResult = {
  applicationId: string;
  company: string;
  position: string;
  type: "resume" | "cover_letter";
  fileName: string;
  text: string | null;
  error: string | null;
};

function buildContext(
  applications: AppRow[] | null,
  interviews: InterviewRow[] | null,
  reminders: ReminderRow[] | null,
  contacts: ContactRow[] | null,
  tags: Array<{ application_id: string; tag_name: string }>,
  activityLogs: ActivityRow[] | null,
  salaryDetails: SalaryRow[],
  emailTemplates: TemplateRow[] | null,
  documentTexts: DocResult[],
  opts: TrimOptions = {},
): string {
  const parts: string[] = [];
  const now = new Date();

  // ── Applications ──────────────────────────────────────────────────────────
  if (applications && applications.length > 0) {
    const statusCounts: Record<string, number> = {};
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
    let thisMonthCount = 0;
    let thisWeekCount = 0;

    const tagsByApp: Record<string, string[]> = {};
    for (const t of tags) {
      if (!tagsByApp[t.application_id]) tagsByApp[t.application_id] = [];
      tagsByApp[t.application_id].push(t.tag_name);
    }

    const salaryByApp: Record<string, SalaryRow> = {};
    for (const s of salaryDetails) {
      salaryByApp[s.application_id] = s;
    }

    applications.forEach((app) => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      const d = new Date(app.applied_date);
      if (d >= thisMonthStart) thisMonthCount++;
      if (d >= thisWeekStart) thisWeekCount++;
    });

    const appsWithResume = applications.filter((a) => a.resume_path).length;
    const appsWithCoverLetter = applications.filter((a) => a.cover_letter_path).length;

    parts.push(
      `APPLICATIONS — Total: ${applications.length} | This week: ${thisWeekCount} | This month: ${thisMonthCount}`,
      `Status breakdown: ${Object.entries(statusCounts).map(([s, c]) => `${s}: ${c}`).join(" | ")}`,
      `Documents on file: ${appsWithResume} resume(s), ${appsWithCoverLetter} cover letter(s) uploaded. Full text of each document is included in the DOCUMENT CONTENTS section below.`,
    );

    // Every single application
    applications.forEach((app) => {
      const appTags = tagsByApp[app.id];
      const sal = salaryByApp[app.id];
      const docs: string[] = [];
      if (app.resume_path) docs.push(`resume: "${fileName(app.resume_path)}"`);
      if (app.cover_letter_path) docs.push(`cover letter: "${fileName(app.cover_letter_path)}"`);

      const salParts: string[] = [];
      if (sal) {
        if (sal.base_salary) salParts.push(`Base: ${fmtMoney(sal.base_salary, sal.currency)}`);
        if (sal.bonus) salParts.push(`Bonus: ${fmtMoney(sal.bonus, sal.currency)}`);
        if (sal.signing_bonus) salParts.push(`Signing: ${fmtMoney(sal.signing_bonus, sal.currency)}`);
        if (sal.equity) salParts.push(`Equity: ${sal.equity}`);
        if (sal.final_offer) salParts.push(`Final offer: ${fmtMoney(sal.final_offer, sal.currency)}`);
        if (sal.offer_deadline) salParts.push(`Offer deadline: ${fmt(sal.offer_deadline)}`);
        if (sal.benefits) salParts.push(`Benefits: ${sal.benefits}`);
        if (sal.notes) salParts.push(`Salary notes: ${sal.notes}`);
      }

      const line = [
        `• ${app.position} @ ${app.company} [${app.status}]`,
        `Applied: ${fmt(app.applied_date)}`,
        app.location ? `📍 ${app.location}` : null,
        app.salary_range ? `💰 ${app.salary_range}` : null,
        salParts.length ? `💵 ${salParts.join(", ")}` : null,
        docs.length ? `📎 ${docs.join(" + ")} uploaded` : null,
        appTags?.length ? `🏷 ${appTags.join(", ")}` : null,
        app.job_url ? `🔗 Job URL on file` : null,
        app.notes ? `Note: "${app.notes}"` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      parts.push(line);
    });
  } else {
    parts.push("APPLICATIONS: None tracked yet.");
  }

  // ── Interviews ────────────────────────────────────────────────────────────
  parts.push("");
  if (interviews && interviews.length > 0) {
    const upcoming = interviews.filter((i) => new Date(i.scheduled_at) >= now && i.status === "Scheduled");
    const past = interviews.filter((i) => new Date(i.scheduled_at) < now || i.status !== "Scheduled");

    parts.push(`INTERVIEWS — Total: ${interviews.length} | Upcoming: ${upcoming.length} | Past/other: ${past.length}`);

    // All upcoming
    upcoming.forEach((iv) => {
      const co = iv.job_applications?.company || "?";
      const pos = iv.job_applications?.position || "?";
      const line = [
        `• [UPCOMING] ${iv.type} Round ${iv.round} — ${pos} @ ${co}`,
        `⏰ ${new Date(iv.scheduled_at).toLocaleString()}`,
        iv.duration_minutes ? `${iv.duration_minutes} min` : null,
        iv.location ? `📍 ${iv.location}` : null,
        iv.meeting_url ? `🔗 Video call` : null,
        iv.interviewer_names?.length ? `Interviewers: ${iv.interviewer_names.join(", ")}` : null,
        iv.notes ? `Notes: "${iv.notes}"` : null,
      ].filter(Boolean).join(" | ");
      parts.push(line);
    });

    // All past interviews
    past.forEach((iv) => {
      const co = iv.job_applications?.company || "?";
      const pos = iv.job_applications?.position || "?";
      const line = [
        `• [${iv.status.toUpperCase()}] ${iv.type} Round ${iv.round} — ${pos} @ ${co}`,
        fmt(iv.scheduled_at),
        iv.interviewer_names?.length ? `Interviewers: ${iv.interviewer_names.join(", ")}` : null,
        iv.notes ? `Notes: "${iv.notes}"` : null,
      ].filter(Boolean).join(" | ");
      parts.push(line);
    });
  } else {
    parts.push("INTERVIEWS: None recorded.");
  }

  // ── Reminders ─────────────────────────────────────────────────────────────
  parts.push("");
  if (reminders && reminders.length > 0) {
    const overdue = reminders.filter((r) => !r.is_completed && new Date(r.due_date) < now);
    const pending = reminders.filter((r) => !r.is_completed && new Date(r.due_date) >= now);
    const completed = reminders.filter((r) => r.is_completed);

    parts.push(`REMINDERS — Total: ${reminders.length} | Overdue: ${overdue.length} | Pending: ${pending.length} | Completed: ${completed.length}`);

    // All overdue first
    overdue.forEach((r) => {
      const co = r.job_applications?.company || "General";
      parts.push(`• [OVERDUE] ${r.title} (${r.type || "Reminder"}) — ${co} | Due: ${fmt(r.due_date)}${r.notes ? ` | Note: "${r.notes}"` : ""}`);
    });

    // All pending
    pending.forEach((r) => {
      const co = r.job_applications?.company || "General";
      parts.push(`• [PENDING] ${r.title} (${r.type || "Reminder"}) — ${co} | Due: ${fmt(r.due_date)}${r.notes ? ` | Note: "${r.notes}"` : ""}`);
    });

    // Completed (compact)
    if (completed.length > 0) {
      parts.push(`• ${completed.length} reminder(s) already completed.`);
    }
  } else {
    parts.push("REMINDERS: None set.");
  }

  // ── Contacts ──────────────────────────────────────────────────────────────
  parts.push("");
  if (contacts && contacts.length > 0) {
    parts.push(`CONTACTS — ${contacts.length} total:`);
    contacts.forEach((c) => {
      const line = [
        `• ${c.name}${c.is_primary ? " (primary)" : ""}`,
        c.role ? c.role : null,
        c.company ? `@ ${c.company}` : null,
        c.email ? `✉ ${c.email}` : null,
        c.phone ? `📞 ${c.phone}` : null,
        c.linkedin_url ? `🔗 LinkedIn on file` : null,
        c.notes ? `"${c.notes}"` : null,
      ].filter(Boolean).join(" | ");
      parts.push(line);
    });
  } else {
    parts.push("CONTACTS: None saved.");
  }

  // ── Salary details summary ────────────────────────────────────────────────
  parts.push("");
  if (salaryDetails.length > 0) {
    const withOffers = salaryDetails.filter((s) => s.final_offer);
    const avgBase = salaryDetails
      .filter((s) => s.base_salary)
      .reduce((sum, s, _, arr) => sum + s.base_salary! / arr.length, 0);

    parts.push(
      `SALARY TRACKER — ${salaryDetails.length} application(s) with salary data | ${withOffers.length} with final offer | Avg base: ${avgBase ? fmtMoney(Math.round(avgBase)) : "N/A"}`
    );
  } else {
    parts.push("SALARY TRACKER: No salary data recorded.");
  }

  // ── Email templates ───────────────────────────────────────────────────────
  parts.push("");
  if (emailTemplates && emailTemplates.length > 0) {
    parts.push(`EMAIL TEMPLATES — ${emailTemplates.length} saved:`);
    emailTemplates.forEach((t) => {
      parts.push(`• [${t.category}] "${t.name}" — Subject: "${t.subject}"`);
    });
  } else {
    parts.push("EMAIL TEMPLATES: None saved.");
  }

  // ── Activity log — full history ───────────────────────────────────────────
  parts.push("");
  if (activityLogs && activityLogs.length > 0) {
    const logsToShow = opts.maxActivityLogs != null
      ? activityLogs.slice(0, opts.maxActivityLogs)
      : activityLogs;
    const truncated = logsToShow.length < activityLogs.length
      ? ` (showing newest ${logsToShow.length} of ${activityLogs.length})`
      : "";
    parts.push(`ACTIVITY LOG — ${activityLogs.length} events (newest first)${truncated}:`);
    logsToShow.forEach((log) => {
      const co = log.job_applications?.company || "";
      const pos = log.job_applications?.position || "";
      const appRef = co ? ` [${pos ? pos + " @ " : ""}${co}]` : "";
      parts.push(`• ${fmt(log.created_at)} — ${log.activity_type}${appRef}`);
    });
  } else {
    parts.push("ACTIVITY LOG: No activity recorded.");
  }

  // ── Resume & cover letter full text ───────────────────────────────────────
  parts.push("");
  // opts.maxDocCharsEach === null → omit doc bodies entirely (still list filenames)
  // opts.maxDocCharsEach === N    → truncate each doc body to N chars
  // opts.maxDocCharsEach undefined → full text
  if (documentTexts.length > 0 && opts.maxDocCharsEach !== null) {
    parts.push(`DOCUMENT CONTENTS — ${documentTexts.length} file(s) extracted:`);
    documentTexts.forEach((doc) => {
      const label = doc.type === "resume" ? "RESUME" : "COVER LETTER";
      parts.push(`\n[${label}] "${doc.fileName}" — ${doc.position} @ ${doc.company}`);
      if (doc.text) {
        const maxChars = opts.maxDocCharsEach;
        const body = maxChars != null && doc.text.length > maxChars
          ? doc.text.slice(0, maxChars) + `\n... [truncated to ${maxChars} chars — ask for specific sections]`
          : doc.text;
        parts.push(body);
      } else {
        parts.push(`(Could not extract text: ${doc.error})`);
      }
    });
  } else if (documentTexts.length > 0) {
    // Docs omitted to save tokens — list filenames only
    parts.push(`DOCUMENT CONTENTS — ${documentTexts.length} file(s) on record (omitted to save space). Ask about a specific document to see its content.`);
    documentTexts.forEach((doc) => {
      const label = doc.type === "resume" ? "RESUME" : "COVER LETTER";
      parts.push(`• [${label}] "${doc.fileName}" — ${doc.position} @ ${doc.company}`);
    });
  } else {
    parts.push("DOCUMENT CONTENTS: No documents uploaded.");
  }

  return parts.join("\n");
}
