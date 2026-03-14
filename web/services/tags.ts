import { createClient } from "@/lib/supabase/server";
import type { Tag, TagInsert, TagUpdate, ApiResponse } from "@/types";

export async function getTags(): Promise<ApiResponse<Tag[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Tag[], error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch tags" },
    };
  }
}

export async function getApplicationTags(
  applicationId: string
): Promise<ApiResponse<Tag[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("application_tags")
      .select("tag_id, tags(*)")
      .eq("application_id", applicationId);

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    const tags = data?.map((item: any) => item.tags).filter(Boolean) as Tag[];

    return { data: tags, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to fetch application tags" },
    };
  }
}

export async function createTag(tag: TagInsert): Promise<ApiResponse<Tag>> {
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
      .from("tags")
      .insert({ ...tag, user_id: user.id })
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: data as Tag, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to create tag" },
    };
  }
}

export async function updateTag(
  id: string,
  updates: TagUpdate
): Promise<ApiResponse<Tag>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tags")
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

    return { data: data as Tag, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to update tag" },
    };
  }
}

export async function deleteTag(id: string): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("tags").delete().eq("id", id);

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
      error: { message: "Failed to delete tag" },
    };
  }
}

export async function addTagToApplication(
  applicationId: string,
  tagId: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("application_tags")
      .insert({ application_id: applicationId, tag_id: tagId });

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
      error: { message: "Failed to add tag to application" },
    };
  }
}

export async function removeTagFromApplication(
  applicationId: string,
  tagId: string
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("application_tags")
      .delete()
      .eq("application_id", applicationId)
      .eq("tag_id", tagId);

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
      error: { message: "Failed to remove tag from application" },
    };
  }
}
