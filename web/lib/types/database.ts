// Re-export from validations for consistency
export {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/validations/application";

export interface JobApplication {
  id: string;
  user_id: string;
  company: string;
  position: string;
  job_id: string | null;
  job_url: string | null;
  status: "Applied" | "Phone Screen" | "Interview" | "Offer" | "Rejected";
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
  status?: JobApplication["status"];
  applied_date?: string;
  salary_range?: string | null;
  location?: string | null;
  notes?: string | null;
  resume_path?: string | null;
  cover_letter_path?: string | null;
}

export interface JobApplicationUpdate extends Partial<JobApplicationInsert> {}

// Database response types
export interface ApplicationStats {
  total_count: number;
  applied_count: number;
  phone_screen_count: number;
  interview_count: number;
  offer_count: number;
  rejected_count: number;
  this_week_count: number;
  this_month_count: number;
}
