import { createClient } from "@/lib/supabase/server";
import type { ActivityLog, ActivityLogInsert, ApiResponse } from "@/types";

export async function getActivityLogs(
  applicationId: string,
  limit = 50
): Promise<ApiResponse<ActivityLog[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as ActivityLog[], error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch activity logs" },
    };
  }
}

export async function getRecentActivity(
  limit = 20
): Promise<ApiResponse<ActivityLog[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*, job_applications(company, position)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as ActivityLog[], error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch recent activity" },
    };
  }
}

export async function createActivityLog(
  log: ActivityLogInsert
): Promise<ApiResponse<ActivityLog>> {
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
      .from("activity_logs")
      .insert({ ...log, user_id: user.id })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as ActivityLog, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to create activity log" },
    };
  }
}

// Helper to format activity for display
export function formatActivityDescription(log: ActivityLog): string {
  switch (log.activity_type) {
    case "Created":
      return "Application created";
    case "Status Changed":
      const oldStatus = (log.metadata as any)?.old_status || "Unknown";
      const newStatus = (log.metadata as any)?.new_status || "Unknown";
      return `Status changed from ${oldStatus} to ${newStatus}`;
    case "Interview Scheduled":
      return "Interview scheduled";
    case "Interview Completed":
      return "Interview completed";
    case "Note Added":
      return "Note added";
    case "Document Uploaded":
      return "Document uploaded";
    case "Reminder Set":
      return "Reminder set";
    case "Contact Added":
      return "Contact added";
    case "Updated":
      return "Application updated";
    default:
      return log.description;
  }
}

// Get activity icon based on type
export function getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    Created: "plus-circle",
    "Status Changed": "refresh-cw",
    "Interview Scheduled": "calendar",
    "Interview Completed": "check-circle",
    "Note Added": "file-text",
    "Document Uploaded": "upload",
    "Reminder Set": "bell",
    "Contact Added": "user-plus",
    Updated: "edit",
  };
  return icons[type] || "activity";
}
