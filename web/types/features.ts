// Interview Types
export type InterviewType =
  | "Phone Screen"
  | "Technical"
  | "Behavioral"
  | "On-site"
  | "Panel"
  | "Final"
  | "Other";

export type InterviewStatus =
  | "Scheduled"
  | "Completed"
  | "Cancelled"
  | "Rescheduled"
  | "No Show";

export interface Interview {
  id: string;
  user_id: string;
  application_id: string;
  type: InterviewType;
  status: InterviewStatus;
  round: number;
  scheduled_at: string;
  duration_minutes: number;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  meeting_id: string | null;
  interviewer_names: string[] | null;
  preparation_notes: string | null;
  post_interview_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewInsert {
  application_id: string;
  type?: InterviewType;
  status?: InterviewStatus;
  round?: number;
  scheduled_at: string;
  duration_minutes?: number;
  timezone?: string;
  location?: string | null;
  meeting_url?: string | null;
  meeting_id?: string | null;
  interviewer_names?: string[] | null;
  preparation_notes?: string | null;
  post_interview_notes?: string | null;
}

export interface InterviewUpdate extends Partial<InterviewInsert> {}

// Contact Types
export interface Contact {
  id: string;
  user_id: string;
  application_id: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactInsert {
  application_id?: string | null;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  notes?: string | null;
  is_primary?: boolean;
}

export interface ContactUpdate extends Partial<ContactInsert> {}

// Tag Types
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TagInsert {
  name: string;
  color?: string;
}

export interface TagUpdate extends Partial<TagInsert> {}

export interface ApplicationTag {
  application_id: string;
  tag_id: string;
  created_at: string;
}

// Activity Log Types
export type ActivityType =
  | "Created"
  | "Status Changed"
  | "Interview Scheduled"
  | "Interview Completed"
  | "Note Added"
  | "Document Uploaded"
  | "Reminder Set"
  | "Contact Added"
  | "Updated";

export interface ActivityLog {
  id: string;
  user_id: string;
  application_id: string;
  activity_type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogInsert {
  application_id: string;
  activity_type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

// Reminder Types
export type ReminderType = "Follow Up" | "Interview" | "Deadline" | "Custom";

export interface Reminder {
  id: string;
  user_id: string;
  application_id: string | null;
  type: ReminderType;
  title: string;
  description: string | null;
  remind_at: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderInsert {
  application_id?: string | null;
  type?: ReminderType;
  title: string;
  description?: string | null;
  remind_at: string;
}

export interface ReminderUpdate extends Partial<ReminderInsert> {
  is_completed?: boolean;
  completed_at?: string | null;
}

// Email Template Types
export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateInsert {
  name: string;
  subject: string;
  body: string;
  category?: string;
}

export interface EmailTemplateUpdate extends Partial<EmailTemplateInsert> {}

// Salary Details Types
export interface SalaryDetails {
  id: string;
  application_id: string;
  base_salary: number | null;
  currency: string;
  salary_type: "yearly" | "monthly" | "hourly";
  bonus: number | null;
  equity: string | null;
  signing_bonus: number | null;
  health_insurance: boolean;
  dental_insurance: boolean;
  vision_insurance: boolean;
  retirement_401k: boolean;
  retirement_match: string | null;
  pto_days: number | null;
  remote_work: string | null;
  other_benefits: string[] | null;
  initial_offer: number | null;
  final_offer: number | null;
  negotiation_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryDetailsInsert {
  application_id: string;
  base_salary?: number | null;
  currency?: string;
  salary_type?: "yearly" | "monthly" | "hourly";
  bonus?: number | null;
  equity?: string | null;
  signing_bonus?: number | null;
  health_insurance?: boolean;
  dental_insurance?: boolean;
  vision_insurance?: boolean;
  retirement_401k?: boolean;
  retirement_match?: string | null;
  pto_days?: number | null;
  remote_work?: string | null;
  other_benefits?: string[] | null;
  initial_offer?: number | null;
  final_offer?: number | null;
  negotiation_notes?: string | null;
}

export interface SalaryDetailsUpdate extends Partial<Omit<SalaryDetailsInsert, "application_id">> {}

// Dashboard Analytics Types
export interface DashboardAnalytics {
  totalApplications: number;
  thisWeek: number;
  thisMonth: number;
  responseRate: number;
  averageTimeToResponse: number | null;
  statusDistribution: StatusCount[];
  weeklyTrends: WeeklyTrend[];
  monthlyTrends: MonthlyTrend[];
  topCompanies: CompanyCount[];
  upcomingInterviews: Interview[];
  pendingReminders: Reminder[];
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface WeeklyTrend {
  week: string;
  count: number;
}

export interface MonthlyTrend {
  month: string;
  count: number;
  offers: number;
  rejections: number;
}

export interface CompanyCount {
  company: string;
  count: number;
}

// Extended Job Application with relations
export interface JobApplicationWithRelations {
  id: string;
  user_id: string;
  company: string;
  position: string;
  job_id: string | null;
  job_url: string | null;
  status: string;
  applied_date: string;
  salary_range: string | null;
  location: string | null;
  notes: string | null;
  resume_path: string | null;
  cover_letter_path: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  interviews?: Interview[];
  contacts?: Contact[];
  salary_details?: SalaryDetails;
  activity_logs?: ActivityLog[];
}
