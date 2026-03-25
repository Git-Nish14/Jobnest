import { createClient } from "@/lib/supabase/server";
import type {
  Interview,
  InterviewInsert,
  InterviewUpdate,
  ApiResponse,
} from "@/types";

export async function getInterviews(
  applicationId?: string
): Promise<ApiResponse<Interview[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("interviews")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (applicationId) {
      query = query.eq("application_id", applicationId);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Interview[], error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch interviews" },
    };
  }
}

export async function getUpcomingInterviews(
  limit = 10
): Promise<ApiResponse<Interview[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("interviews")
      .select("*, job_applications(company, position)")
      .eq("status", "Scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Interview[], error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch upcoming interviews" },
    };
  }
}

export async function getInterviewById(
  id: string
): Promise<ApiResponse<Interview>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Interview, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch interview" },
    };
  }
}

export async function createInterview(
  interview: InterviewInsert
): Promise<ApiResponse<Interview>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: { message: "Not authenticated" },
      };
    }

    const { data, error } = await supabase
      .from("interviews")
      .insert({ ...interview, user_id: user.id })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Interview, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to create interview" },
    };
  }
}

export async function updateInterview(
  id: string,
  updates: InterviewUpdate
): Promise<ApiResponse<Interview>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("interviews")
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

    return { data: data as Interview, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to update interview" },
    };
  }
}

export async function deleteInterview(id: string): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("interviews").delete().eq("id", id);

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
      error: { message: "Failed to delete interview" },
    };
  }
}
