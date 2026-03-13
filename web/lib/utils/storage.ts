import { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "documents";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadFile(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  file: File,
  type: "resume" | "cover_letter"
): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 5MB limit");
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${applicationId}/${type}.${fileExt}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: true });

  if (error) {
    throw error;
  }

  return filePath;
}

export async function deleteFile(
  supabase: SupabaseClient,
  filePath: string
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    throw error;
  }
}

export async function getSignedUrl(
  supabase: SupabaseClient,
  filePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error("Error getting signed URL:", error);
    return null;
  }

  return data.signedUrl;
}
