import { createClient } from "@/lib/supabase/server";
import type {
  Contact,
  ContactInsert,
  ContactUpdate,
  ApiResponse,
} from "@/types";

export async function getContacts(
  applicationId?: string
): Promise<ApiResponse<Contact[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("contacts")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });

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

    return { data: data as Contact[], error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch contacts" },
    };
  }
}

export async function getContactById(
  id: string
): Promise<ApiResponse<Contact>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Contact, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to fetch contact" },
    };
  }
}

export async function createContact(
  contact: ContactInsert
): Promise<ApiResponse<Contact>> {
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
      .from("contacts")
      .insert({ ...contact, user_id: user.id })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Contact, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to create contact" },
    };
  }
}

export async function updateContact(
  id: string,
  updates: ContactUpdate
): Promise<ApiResponse<Contact>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("contacts")
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

    return { data: data as Contact, error: null };
  } catch {
    return {
      data: null,
      error: { message: "Failed to update contact" },
    };
  }
}

export async function deleteContact(id: string): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("contacts").delete().eq("id", id);

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
      error: { message: "Failed to delete contact" },
    };
  }
}
