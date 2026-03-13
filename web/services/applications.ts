import { createClient } from "@/lib/supabase/server";
import type {
  JobApplication,
  JobApplicationInsert,
  JobApplicationUpdate,
  ApplicationStats,
  ApiResponse,
  QueryParams,
} from "@/types";
import type { ApplicationStatus } from "@/config/constants";

export async function getApplications(
  params?: QueryParams
): Promise<ApiResponse<JobApplication[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("job_applications")
      .select("*")
      .order("applied_date", { ascending: false });

    if (params?.search) {
      query = query.or(
        `company.ilike.%${params.search}%,position.ilike.%${params.search}%`
      );
    }

    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as JobApplication[], error: null };
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
