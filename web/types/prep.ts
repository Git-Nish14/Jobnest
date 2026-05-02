export type ProblemDifficulty = "Easy" | "Medium" | "Hard";
export type ProblemStatus = "Todo" | "Attempted" | "Solved" | "Review";
export type ProblemTopic =
  | "Array" | "String" | "Linked List" | "Tree" | "Graph" | "DP"
  | "Heap" | "Stack" | "Queue" | "Hash Map" | "Binary Search"
  | "Backtracking" | "Greedy" | "Math" | "Bit Manipulation" | "Other";

export interface CodingProblem {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  difficulty: ProblemDifficulty;
  topic: string;
  status: ProblemStatus;
  company_tags: string[];
  time_to_solve_minutes: number | null;
  notes: string | null;
  solution_url: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AssessmentStatus = "Pending" | "In Progress" | "Submitted" | "Passed" | "Failed";

export interface Assessment {
  id: string;
  user_id: string;
  application_id: string | null;
  title: string;
  platform: string | null;
  assigned_at: string | null;
  deadline: string | null;
  time_limit_hours: number | null;
  tech_stack: string[];
  status: AssessmentStatus;
  score: number | null;
  feedback: string | null;
  time_spent_minutes: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  job_applications?: { company?: string; position?: string } | null;
}

export type BehavioralCompetency =
  | "Leadership" | "Conflict" | "Failure" | "Achievement"
  | "Teamwork" | "Communication" | "Problem Solving" | "Other";

export interface BehavioralAnswer {
  id: string;
  user_id: string;
  question: string;
  competency: BehavioralCompetency | null;
  situation: string | null;
  task_desc: string | null;
  action: string | null;
  result: string | null;
  last_updated: string;
  created_at: string;
}

export type MockInterviewType = "DSA" | "Behavioral" | "System Design" | "Mixed";
export type MockInterviewStatus = "Scheduled" | "Completed" | "Cancelled";

export interface MockInterview {
  id: string;
  user_id: string;
  scheduled_at: string;
  type: MockInterviewType;
  status: MockInterviewStatus;
  partner_name: string | null;
  score: number | null;
  feedback: string | null;
  topics_to_revisit: string[];
  created_at: string;
  updated_at: string;
}

export type QuestionCategory =
  | "DSA" | "Behavioral" | "System Design"
  | "Domain Knowledge" | "Culture Fit" | "Other";

export interface InterviewQuestion {
  id: string;
  user_id: string;
  interview_id: string;
  question: string;
  category: QuestionCategory | null;
  difficulty: ProblemDifficulty | null;
  notes: string | null;
  created_at: string;
  // Joined
  interviews?: {
    scheduled_at: string;
    job_applications?: { company?: string; position?: string } | null;
  } | null;
}

export type SystemDesignStatus = "Not Started" | "Reading" | "Comfortable";

export interface PrepStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  system_design_progress: Record<string, SystemDesignStatus>;
  created_at: string;
  updated_at: string;
}

export const SYSTEM_DESIGN_TOPICS = [
  "Load Balancer",
  "CDN",
  "Database Sharding",
  "CAP Theorem",
  "Rate Limiting",
  "Message Queues",
  "Caching",
  "Consistent Hashing",
  "SQL vs NoSQL",
  "Microservices",
  "API Design (REST/GraphQL)",
  "WebSockets",
  "Search Systems",
  "Distributed Transactions",
  "Monitoring & Observability",
] as const;

export const PROBLEM_TOPICS = [
  "Array", "String", "Linked List", "Tree", "Graph", "DP",
  "Heap", "Stack", "Queue", "Hash Map", "Binary Search",
  "Backtracking", "Greedy", "Math", "Bit Manipulation", "Other",
] as const;

export const BEHAVIORAL_QUESTIONS_SEED = [
  { question: "Tell me about a time you led a team through a difficult project.", competency: "Leadership" as BehavioralCompetency },
  { question: "Describe a conflict with a teammate and how you resolved it.", competency: "Conflict" as BehavioralCompetency },
  { question: "Tell me about your biggest professional failure and what you learned.", competency: "Failure" as BehavioralCompetency },
  { question: "What's your greatest technical achievement?", competency: "Achievement" as BehavioralCompetency },
  { question: "How have you contributed to a team's success?", competency: "Teamwork" as BehavioralCompetency },
  { question: "Describe a time you had to explain a complex technical concept to a non-technical stakeholder.", competency: "Communication" as BehavioralCompetency },
  { question: "Tell me about a time you solved a problem no one else could figure out.", competency: "Problem Solving" as BehavioralCompetency },
  { question: "How do you handle tight deadlines and competing priorities?", competency: "Achievement" as BehavioralCompetency },
  { question: "Describe a situation where you disagreed with your manager.", competency: "Conflict" as BehavioralCompetency },
  { question: "Tell me about a time you had to adapt quickly to a major change.", competency: "Problem Solving" as BehavioralCompetency },
  { question: "Describe a time you went above and beyond your role.", competency: "Achievement" as BehavioralCompetency },
  { question: "How do you approach mentoring junior engineers?", competency: "Leadership" as BehavioralCompetency },
  { question: "Tell me about a time you delivered critical feedback.", competency: "Communication" as BehavioralCompetency },
  { question: "Describe a time you had to make a decision with incomplete information.", competency: "Problem Solving" as BehavioralCompetency },
  { question: "How have you improved a broken process or workflow?", competency: "Achievement" as BehavioralCompetency },
] as const;
