export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Set when the database query failed. */
  error?: string;
}

export interface QueryParams {
  search?: string;
  status?: string;
  location?: string;
  dateRange?: "all" | "today" | "week" | "month" | "quarter" | "year";
  sort?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** When true, only return applications where requires_sponsorship = true. */
  sponsorshipOnly?: boolean;
  /** Filter by company tier. */
  tier?: string;
}

/** Items per page used by paginated queries. Defined here (not in services/)
 *  so client components can import it without pulling in server-only Supabase modules. */
export const APPLICATIONS_PAGE_SIZE = 25;
