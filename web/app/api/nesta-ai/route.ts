import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nestaAiSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractAllDocuments } from "@/lib/utils/document-parser";

const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 1000;

// ── Document parse cache (per user, 5-minute TTL) ────────────────────────────
const DOC_CACHE_TTL = 5 * 60 * 1000;

interface DocCacheEntry {
  texts: Awaited<ReturnType<typeof extractAllDocuments>>;
  parsedAt: number;
}

const docCache = new Map<string, DocCacheEntry>();

function getDocCache(userId: string): DocCacheEntry["texts"] | null {
  const entry = docCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.parsedAt > DOC_CACHE_TTL) {
    docCache.delete(userId);
    return null;
  }
  return entry.texts;
}

function setDocCache(userId: string, texts: DocCacheEntry["texts"]): void {
  docCache.set(userId, { texts, parsedAt: Date.now() });
  // Opportunistic cleanup — remove entries older than TTL
  if (Math.random() < 0.05) {
    const cutoff = Date.now() - DOC_CACHE_TTL;
    for (const [key, val] of docCache) {
      if (val.parsedAt < cutoff) docCache.delete(key);
    }
  }
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

    // Rate limit check
    const rateLimit = checkRateLimit(`nesta:${user.id}`, {
      maxRequests: MAX_REQUESTS,
      windowMs: WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Rate limit reached. You can send ${MAX_REQUESTS} messages per minute.`,
          resetIn: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(MAX_REQUESTS),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetTime / 1000)),
          },
        }
      );
    }

    const { question, history } = await validateBody(request, nestaAiSchema);

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
    let salaryDetails: any[] = [];

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
        tags = tagRows.flatMap((row: any) => {
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
    let documentTexts: DocCacheEntry["texts"] = [];
    if (applications && applications.length > 0) {
      const cached = getDocCache(user.id);
      if (cached) {
        documentTexts = cached;
      } else {
        documentTexts = await extractAllDocuments(supabase, applications);
        setDocCache(user.id, documentTexts);
      }
    }

    const context = buildContext(
      applications,
      interviews,
      reminders,
      contacts,
      tags,
      activityLogs,
      salaryDetails,
      emailTemplates,
      documentTexts,
    );

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Please add GROQ_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    const systemPrompt = `You are NESTAi, a sharp and helpful AI assistant built into Jobnest — a job application tracking platform. You have complete access to this user's job search data and must use it to give accurate, specific answers.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

=== USER'S COMPLETE JOB SEARCH DATA ===
${context}
=== END OF DATA ===

Guidelines:
- Use the data above to answer accurately. Never say you don't have data if it's listed above.
- Be concise and direct. Use bullet points for lists.
- Quote specific numbers, names, companies, and dates from the data.
- Resumes and cover letters: full extracted text is included in the DOCUMENT CONTENTS section. You CAN read, quote, and summarise their content. If a document says "(Could not extract text: ...)", explain that to the user and suggest they check the file format.
- When relevant, suggest a concrete next step.
- Use conversation history for natural follow-ups.`;

    const groqMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10),
      { role: "user" as const, content: question },
    ];

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
        max_tokens: 1024,
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

    const groqData = await groqResponse.json();
    const answer =
      groqData.choices?.[0]?.message?.content ||
      "I couldn't generate a response — please try again.";

    const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);

    return NextResponse.json({
      answer,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: resetInSeconds,
        limit: MAX_REQUESTS,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
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

function fmtMoney(amount: number | null, currency = "USD") {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

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
  applications: any[] | null,
  interviews: any[] | null,
  reminders: any[] | null,
  contacts: any[] | null,
  tags: Array<{ application_id: string; tag_name: string }>,
  activityLogs: any[] | null,
  salaryDetails: any[],
  emailTemplates: any[] | null,
  documentTexts: DocResult[],
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

    const salaryByApp: Record<string, any> = {};
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
      `Documents on file: ${appsWithResume} resume(s), ${appsWithCoverLetter} cover letter(s) uploaded. Filenames are listed per application below. File contents cannot be read — only the filename is available.`,
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
      .reduce((sum, s, _, arr) => sum + s.base_salary / arr.length, 0);

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
    parts.push(`ACTIVITY LOG — ${activityLogs.length} events (newest first):`);
    activityLogs.forEach((log) => {
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
  if (documentTexts.length > 0) {
    parts.push(`DOCUMENT CONTENTS — ${documentTexts.length} file(s) extracted:`);
    documentTexts.forEach((doc) => {
      const label = doc.type === "resume" ? "RESUME" : "COVER LETTER";
      parts.push(`\n[${label}] "${doc.fileName}" — ${doc.position} @ ${doc.company}`);
      if (doc.text) {
        parts.push(doc.text);
      } else {
        parts.push(`(Could not extract text: ${doc.error})`);
      }
    });
  } else {
    parts.push("DOCUMENT CONTENTS: No documents uploaded.");
  }

  return parts.join("\n");
}
