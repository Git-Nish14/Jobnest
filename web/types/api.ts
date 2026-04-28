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
  /** Opaque base64-encoded cursor for keyset pagination (applied_date|id). */
  cursor?: string;
}

/** Items per page used by cursor-paginated queries. Defined here (not in services/)
 *  so client components can import it without pulling in server-only Supabase modules. */
export const APPLICATIONS_PAGE_SIZE = 25;

/** Result shape for cursor-paginated queries. */
export interface CursorPage<T> {
  data: T[];
  hasMore: boolean;
  /** Pass this as `cursor` on the next request to get the next page. null when no more pages. */
  nextCursor: string | null;
  /** Set when a DB or auth error occurred. Callers should distinguish this from a real empty list. */
  error?: string;
}
