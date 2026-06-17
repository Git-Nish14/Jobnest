import { createClient } from "@/lib/supabase/server";
import type {
  JobApplication,
  JobApplicationInsert,
  JobApplicationUpdate,
  ApplicationStats,
  ApiResponse,
  QueryParams,
  CursorPage,
} from "@/types";
import { APPLICATIONS_PAGE_SIZE } from "@/types/api";
import type { ApplicationStatus } from "@/config/constants";

export { APPLICATIONS_PAGE_SIZE };

// ── Cursor helpers ────────────────────────────────────────────────────────────

function encodeCursor(app: JobApplication): string {
  return btoa(`${app.applied_date}|${app.id}`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeCursor(cursor: string): { date: string; id: string } | null {
  try {
    const raw = atob(cursor);
    const [date, id] = raw.split("|");
    if (!date || !id) return null;
    // Strict format validation prevents PostgREST filter-string injection
    if (!DATE_RE.test(date) || !UUID_RE.test(id)) return null;
    return { date, id };
  } catch {
    return null;
  }
}

/** Strip characters that have special meaning in PostgREST .or() filter grammar. */
function sanitizeFilterTerm(s: string): string {
  return s.replace(/[,()."']/g, " ").slice(0, 200);
}

/**
 * Keyset-paginated application fetch.
 * Always sorts by applied_date DESC, id DESC so the cursor is stable across
 * concurrent inserts. Returns at most APPLICATIONS_PAGE_SIZE rows.
 */
export async function getApplicationsPage(
  params?: QueryParams
): Promise<CursorPage<JobApplication>> {
  try {
    const supabase = await createClient();

    let query = supabase.from("job_applications").select("*");

    // Apply the same filters as getApplications
    if (params?.search) {
      const s = sanitizeFilterTerm(params.search);
      query = query.or(`company.ilike.%${s}%,position.ilike.%${s}%,job_id.ilike.%${s}%`);
    }
    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params?.location) {
      query = query.ilike("location", `%${sanitizeFilterTerm(params.location)}%`);
    }
    if (params?.dateRange && params.dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
      switch (params.dateRange) {
        case "today":   startDate = new Date(now); startDate.setHours(0, 0, 0, 0); break;
        case "week":    startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); startDate.setHours(0,0,0,0); break;
        case "month":   startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case "quarter": startDate = new Date(now); startDate.setMonth(now.getMonth() - 3); break;
        case "year":    startDate = new Date(now.getFullYear(), 0, 1); break;
        default:        startDate = new Date(0);
      }
      query = query.gte("applied_date", startDate.toISOString().split("T")[0]);
    }
    if (params?.sponsorshipOnly) {
      query = query.eq("requires_sponsorship", true);
    }
    if (params?.tier && params.tier !== "all") {
      query = query.eq("company_tier", params.tier);
    }

    // Keyset cursor: fetch rows after the last seen (applied_date, id) pair.
    // The OR condition covers both "strictly earlier date" and "same date but earlier id".
    if (params?.cursor) {
      const decoded = decodeCursor(params.cursor);
      if (decoded) {
        query = query.or(
          `applied_date.lt.${decoded.date},and(applied_date.eq.${decoded.date},id.lt.${decoded.id})`
        );
      }
    }

    // Consistent sort for stable keyset pagination
    query = query
      .order("applied_date", { ascending: false })
      .order("id",           { ascending: false })
      .limit(APPLICATIONS_PAGE_SIZE + 1); // fetch one extra to detect hasMore

    const { data, error } = await query;

    if (error) {
      return { data: [], hasMore: false, nextCursor: null, error: error.message };
    }

    const rows = (data ?? []) as JobApplication[];
    const hasMore = rows.length > APPLICATIONS_PAGE_SIZE;
    const page    = hasMore ? rows.slice(0, APPLICATIONS_PAGE_SIZE) : rows;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

    return { data: page, hasMore, nextCursor };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { data: [], hasMore: false, nextCursor: null, error: message };
  }
}

export async function getApplications(
  params?: QueryParams
): Promise<ApiResponse<JobApplication[]>> {
  try {
    const supabase = await createClient();

    let query = supabase.from("job_applications").select("*");

    // Search filter
    if (params?.search) {
      const s = sanitizeFilterTerm(params.search);
      query = query.or(`company.ilike.%${s}%,position.ilike.%${s}%,job_id.ilike.%${s}%`);
    }

    // Status filter
    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    // Location filter
    if (params?.location) {
      query = query.ilike("location", `%${sanitizeFilterTerm(params.location)}%`);
    }

    // Date range filter
    if (params?.dateRange && params.dateRange !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (params.dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarter":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      query = query.gte("applied_date", startDate.toISOString().split("T")[0]);
    }

    // Sponsorship filter
    if (params?.sponsorshipOnly) {
      query = query.eq("requires_sponsorship", true);
    }
    if (params?.tier && params.tier !== "all") {
      query = query.eq("company_tier", params.tier);
    }

    // Sorting
    const sort = params?.sort || "date_desc";
    switch (sort) {
      case "date_asc":
        query = query.order("applied_date", { ascending: true });
        break;
      case "company_asc":
        query = query.order("company", { ascending: true });
        break;
      case "company_desc":
        query = query.order("company", { ascending: false });
        break;
      case "position_asc":
        query = query.order("position", { ascending: true });
        break;
      case "date_desc":
      default:
        query = query.order("applied_date", { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as JobApplication[], error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch applications" },
    };
  }
}

export async function getApplicationById(
  id: string
): Promise<ApiResponse<JobApplication>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("job_applications")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as JobApplication, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch application" },
    };
  }
}

export async function createApplication(
  application: JobApplicationInsert
): Promise<ApiResponse<JobApplication>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("job_applications")
      .insert(application)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as JobApplication, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to create application" },
    };
  }
}

export async function updateApplication(
  id: string,
  updates: JobApplicationUpdate
): Promise<ApiResponse<JobApplication>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("job_applications")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as JobApplication, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to update application" },
    };
  }
}

export async function deleteApplication(
  id: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("job_applications")
      .delete()
      .eq("id", id);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: null, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to delete application" },
    };
  }
}

export function calculateStats(applications: JobApplication[]): ApplicationStats {
  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    },
    {} as Record<ApplicationStatus, number>
  );

  const thisWeek = applications.filter(
    (app) => new Date(app.applied_date) >= startOfWeek
  ).length;

  const thisMonth = applications.filter(
    (app) => new Date(app.applied_date) >= startOfMonth
  ).length;

  const active =
    (statusCounts["Applied"] || 0) +
    (statusCounts["Phone Screen"] || 0) +
    (statusCounts["Interview"] || 0);

  return {
    total: applications.length,
    thisWeek,
    thisMonth,
    active,
    statusCounts,
  };
}
