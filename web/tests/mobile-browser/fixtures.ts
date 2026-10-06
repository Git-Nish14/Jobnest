import type { JobApplication } from "@/types";
import { APPLICATION_STATUSES } from "@/config/constants";
// Gesture and draft-cancel tests start from an applied role; include every lifecycle elsewhere.
const fixtureStatuses = ["Applied", ...APPLICATION_STATUSES.filter((status) => status !== "Applied")] as const;

export const applications: JobApplication[] = Array.from({ length: 10 }, (_, index) => ({
  id: `fixture-${index + 1}`,
  user_id: "fixture-user",
  company: index === 0 ? "International Technology & Research Corporation" : ["Northstar", "Linear", "Vercel", "Figma"][index % 4],
  position: index === 0 ? "Senior Software Engineer, Developer Experience & Infrastructure" : "Product Engineer",
  job_id: "ENG-2026-123456",
  job_url: "https://example.invalid/careers/engineer",
  status: fixtureStatuses[index % fixtureStatuses.length],
  applied_date: "2026-09-24",
  salary_range: "$150,000 – $190,000",
  location: "San Francisco, California · Remote friendly",
  notes: "Follow up with the recruiter after the technical conversation. Prepare examples of collaborative leadership and accessible product development.",
  job_description: "Build accessible products for millions of customers. Partner with product, design, and engineering to deliver thoughtful, reliable experiences.",
  source: "LinkedIn",
  ats_provider: "Greenhouse",
  ats_score: 82,
  requires_sponsorship: true,
  company_tier: "Tier 1",
  glassdoor_rating: 4.2,
  has_referral: true,
  resume_path: null,
  cover_letter_path: null,
  created_at: "2026-09-24T12:00:00Z",
  updated_at: "2026-09-24T12:00:00Z",
}));
