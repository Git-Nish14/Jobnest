import { createClient } from "@/lib/supabase/server";
import type {
  EmailTemplate,
  EmailTemplateInsert,
  EmailTemplateUpdate,
  ApiResponse,
} from "@/types";

export async function getEmailTemplates(
  category?: string
): Promise<ApiResponse<EmailTemplate[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("email_templates")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as EmailTemplate[], error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch email templates" },
    };
  }
}

export async function getEmailTemplateById(
  id: string
): Promise<ApiResponse<EmailTemplate>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as EmailTemplate, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch email template" },
    };
  }
}

export async function createEmailTemplate(
  template: EmailTemplateInsert
): Promise<ApiResponse<EmailTemplate>> {
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
      .from("email_templates")
      .insert({ ...template, user_id: user.id })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as EmailTemplate, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to create email template" },
    };
  }
}

export async function updateEmailTemplate(
  id: string,
  updates: EmailTemplateUpdate
): Promise<ApiResponse<EmailTemplate>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("email_templates")
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

    return { data: data as EmailTemplate, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to update email template" },
    };
  }
}

export async function deleteEmailTemplate(
  id: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("email_templates")
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
      error: { message: "Failed to delete email template" },
    };
  }
}

// Helper function to render template with variables
export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  });

  return { subject, body };
}

// Get default template categories
export function getTemplateCategories(): string[] {
  return ["Follow Up", "Thank You", "Offer", "General", "Networking"];
}
