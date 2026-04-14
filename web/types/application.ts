import type { ApplicationStatus } from "@/config/constants";

export interface JobApplication {
  id: string;
  user_id: string;
  company: string;
  position: string;
  job_id: string | null;
  job_url: string | null;
  status: ApplicationStatus;
  applied_date: string;
  salary_range: string | null;
  location: string | null;
  notes: string | null;
  job_description: string | null;
  source: string | null;
  ats_score: number | null;
  resume_path: string | null;
  cover_letter_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationInsert {
  company: string;
  position: string;
  job_id?: string | null;
  job_url?: string | null;
  status?: ApplicationStatus;
  applied_date?: string;
  salary_range?: string | null;
  location?: string | null;
  notes?: string | null;
  resume_path?: string | null;
  cover_letter_path?: string | null;
}

export type JobApplicationUpdate = Partial<JobApplicationInsert>;

// ── Document Storage ──────────────────────────────────────────────────────────

export interface ApplicationDocument {
  id: string;
  application_id: string | null;
  user_id: string;
  label: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  is_current: boolean;
  is_master: boolean;
  uploaded_at: string;
  original_name: string | null;
  // Populated client-side after fetching a signed URL
  signed_url?: string;
}

export interface DocumentSharedLink {
  id: string;
  document_id: string;
  user_id: string;
  token: string;
  expires_at: string;
  view_count: number;
  created_at: string;
}

// MIME types allowed for upload
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
};

// ── Application Stats ─────────────────────────────────────────────────────────

export interface ApplicationStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  active: number;
  statusCounts: Record<ApplicationStatus, number>;
}
