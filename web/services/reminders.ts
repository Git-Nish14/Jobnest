import { createClient } from "@/lib/supabase/server";
import type {
  Reminder,
  ReminderInsert,
  ReminderUpdate,
  ApiResponse,
} from "@/types";

export async function getReminders(
  applicationId?: string,
  includeCompleted = false
): Promise<ApiResponse<Reminder[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("reminders")
      .select("*")
      .order("remind_at", { ascending: true });

    if (applicationId) {
      query = query.eq("application_id", applicationId);
    }

    if (!includeCompleted) {
      query = query.eq("is_completed", false);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Reminder[], error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch reminders" },
    };
  }
}

export async function getUpcomingReminders(
  limit = 10
): Promise<ApiResponse<Reminder[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reminders")
      .select("*, job_applications(company, position)")
      .eq("is_completed", false)
      .gte("remind_at", new Date().toISOString())
      .order("remind_at", { ascending: true })
      .limit(limit);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Reminder[], error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch upcoming reminders" },
    };
  }
}

export async function getDueReminders(): Promise<ApiResponse<Reminder[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reminders")
      .select("*, job_applications(company, position)")
      .eq("is_completed", false)
      .lte("remind_at", new Date().toISOString())
      .order("remind_at", { ascending: true });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Reminder[], error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch due reminders" },
    };
  }
}

export async function getReminderById(
  id: string
): Promise<ApiResponse<Reminder>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Reminder, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch reminder" },
    };
  }
}

export async function createReminder(
  reminder: ReminderInsert
): Promise<ApiResponse<Reminder>> {
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
      .from("reminders")
      .insert({ ...reminder, user_id: user.id })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Reminder, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to create reminder" },
    };
  }
}

export async function updateReminder(
  id: string,
  updates: ReminderUpdate
): Promise<ApiResponse<Reminder>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reminders")
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

    return { data: data as Reminder, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to update reminder" },
    };
  }
}

export async function completeReminder(
  id: string
): Promise<ApiResponse<Reminder>> {
  return updateReminder(id, {
    is_completed: true,
    completed_at: new Date().toISOString(),
  });
}

export async function deleteReminder(id: string): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("reminders").delete().eq("id", id);

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
      error: { message: "Failed to delete reminder" },
    };
  }
}
