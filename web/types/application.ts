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

export interface ApplicationStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  active: number;
  statusCounts: Record<ApplicationStatus, number>;
}
