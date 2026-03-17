import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

// Standard error response structure
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

// HTTP status codes with semantic names
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Custom API Error class
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, string[]>): ApiError {
    return new ApiError(message, HttpStatus.BAD_REQUEST, "BAD_REQUEST", details);
  }

  static unauthorized(message: string = "Unauthorized"): ApiError {
    return new ApiError(message, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
  }

  static forbidden(message: string = "Forbidden"): ApiError {
    return new ApiError(message, HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  static notFound(message: string = "Not found"): ApiError {
    return new ApiError(message, HttpStatus.NOT_FOUND, "NOT_FOUND");
  }

  static conflict(message: string): ApiError {
    return new ApiError(message, HttpStatus.CONFLICT, "CONFLICT");
  }

  static tooManyRequests(message: string = "Too many requests"): ApiError {
    return new ApiError(message, HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED");
  }

  static internal(message: string = "An unexpected error occurred"): ApiError {
    return new ApiError(message, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
  }

  static serviceUnavailable(message: string = "Service unavailable"): ApiError {
    return new ApiError(message, HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE");
  }

  static validation(errors: Record<string, string[]>): ApiError {
    return new ApiError(
      "Validation failed",
      HttpStatus.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
      errors
    );
  }
}

// Convert Zod error to API error
export function zodErrorToApiError(error: ZodError): ApiError {
  const fieldErrors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });

  return ApiError.validation(fieldErrors);
}

// Create error response
export function errorResponse(error: ApiError | Error | unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ApiError) {
    const body: ApiErrorResponse = {
      error: error.message,
      code: error.code,
    };

    if (error.details) {
      body.details = error.details;
    }

    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    const apiError = zodErrorToApiError(error);
    return NextResponse.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
      },
      { status: apiError.statusCode }
    );
  }

  // Log unexpected errors
  console.error("Unexpected error:", error);

  // Don't expose internal error details
  return NextResponse.json(
    { error: "An unexpected error occurred", code: "INTERNAL_ERROR" },
    { status: HttpStatus.INTERNAL_SERVER_ERROR }
  );
}

// Success response helper
export function successResponse<T>(data: T, status: number = HttpStatus.OK): NextResponse<T> {
  return NextResponse.json(data, { status });
}

// Validate request body with Zod
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw zodErrorToApiError(error);
    }
    if (error instanceof SyntaxError) {
      throw ApiError.badRequest("Invalid JSON body");
    }
    throw error;
  }
}

// Validate query params with Zod
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): T {
  const params = Object.fromEntries(searchParams.entries());
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw zodErrorToApiError(error);
    }
    throw error;
  }
}

// Safe async handler wrapper
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch(errorResponse);
}
