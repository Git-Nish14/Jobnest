import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nestaAiSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    // Check rate limit (5 requests per minute per user)
    const rateLimit = checkRateLimit(`nesta:${user.id}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please wait ${resetInSeconds} seconds before asking another question.`,
          resetIn: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + resetInSeconds),
          },
        }
      );
    }

    // Validate input with Zod
    const { question } = await validateBody(request, nestaAiSchema);

    // Fetch user's data for context
    const [
      { data: applications },
      { data: interviews },
      { data: reminders },
      { data: contacts },
    ] = await Promise.all([
      supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("applied_date", { ascending: false }),
      supabase
        .from("interviews")
        .select("*, job_applications(company, position)")
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("reminders")
        .select("*, job_applications(company, position)")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id),
    ]);

    // Build context from user data
    const context = buildContext(applications, interviews, reminders, contacts);

    // Check for Groq API key
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Please add GROQ_API_KEY to environment variables." },
        { status: 500 }
      );
    }

    // Call Groq API (using llama-3.1-8b-instant for free tier)
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are NESTAi, a helpful AI assistant for the Jobnest job application tracking platform. You help users understand their job search progress, analyze their applications, and provide actionable insights.

You have access to the user's job application data. Be concise, helpful, and encouraging. When providing statistics or summaries, be specific with numbers. If the user asks about something not in their data, politely let them know.

Current date: ${new Date().toLocaleDateString()}

USER'S JOB SEARCH DATA:
${context}

Important guidelines:
- Be encouraging and supportive about their job search
- Provide specific numbers and dates when available
- Suggest actionable next steps when appropriate
- Keep responses concise but informative
- If they have no data in a category, acknowledge it kindly`,
          },
          {
            role: "user",
            content: question,
          },
        ],
        temperature: 0.7,
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
    const answer = groqData.choices?.[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";

    return NextResponse.json({
      answer,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function buildContext(
  applications: any[] | null,
  interviews: any[] | null,
  reminders: any[] | null,
  contacts: any[] | null
): string {
  const parts: string[] = [];

  // Applications summary
  if (applications && applications.length > 0) {
    const statusCounts: Record<string, number> = {};
    const thisMonth = new Date();
    thisMonth.setDate(1);
    let thisMonthCount = 0;

    applications.forEach((app) => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      if (new Date(app.applied_date) >= thisMonth) {
        thisMonthCount++;
      }
    });

    parts.push(`APPLICATIONS (Total: ${applications.length}, This Month: ${thisMonthCount}):`);
    parts.push(`Status breakdown: ${Object.entries(statusCounts).map(([s, c]) => `${s}: ${c}`).join(", ")}`);
    parts.push(`Recent applications:`);
    applications.slice(0, 10).forEach((app) => {
      parts.push(`- ${app.position} at ${app.company} (${app.status}) - Applied: ${new Date(app.applied_date).toLocaleDateString()}${app.location ? `, Location: ${app.location}` : ""}${app.salary_range ? `, Salary: ${app.salary_range}` : ""}`);
    });
  } else {
    parts.push("APPLICATIONS: No applications tracked yet.");
  }

  // Interviews
  if (interviews && interviews.length > 0) {
    const upcoming = interviews.filter(
      (i) => new Date(i.scheduled_at) >= new Date() && i.status === "Scheduled"
    );
    const completed = interviews.filter((i) => i.status === "Completed");

    parts.push(`\nINTERVIEWS (Total: ${interviews.length}, Upcoming: ${upcoming.length}, Completed: ${completed.length}):`);

    if (upcoming.length > 0) {
      parts.push("Upcoming interviews:");
      upcoming.slice(0, 5).forEach((int) => {
        const company = int.job_applications?.company || "Unknown";
        const position = int.job_applications?.position || "Unknown";
        parts.push(`- ${int.type} for ${position} at ${company} - ${new Date(int.scheduled_at).toLocaleString()}`);
      });
    }
  } else {
    parts.push("\nINTERVIEWS: No interviews scheduled.");
  }

  // Reminders
  if (reminders && reminders.length > 0) {
    const pending = reminders.filter((r) => !r.is_completed && new Date(r.due_date) >= new Date());
    const overdue = reminders.filter((r) => !r.is_completed && new Date(r.due_date) < new Date());

    parts.push(`\nREMINDERS (Total: ${reminders.length}, Pending: ${pending.length}, Overdue: ${overdue.length}):`);

    if (pending.length > 0 || overdue.length > 0) {
      [...overdue, ...pending].slice(0, 5).forEach((rem) => {
        const company = rem.job_applications?.company || "General";
        const isOverdue = new Date(rem.due_date) < new Date();
        parts.push(`- ${rem.title} (${company}) - Due: ${new Date(rem.due_date).toLocaleDateString()}${isOverdue ? " [OVERDUE]" : ""}`);
      });
    }
  } else {
    parts.push("\nREMINDERS: No reminders set.");
  }

  // Contacts
  if (contacts && contacts.length > 0) {
    parts.push(`\nCONTACTS: ${contacts.length} professional contacts saved.`);
  } else {
    parts.push("\nCONTACTS: No contacts saved.");
  }

  return parts.join("\n");
}
