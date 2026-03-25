import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ApiError,
  HttpStatus,
  errorResponse,
  successResponse,
  validateBody,
  zodErrorToApiError,
} from "@/lib/api/errors";

describe("ApiError", () => {
  it("creates with correct status and code", () => {
    const err = ApiError.badRequest("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("bad input");
  });

  it("unauthorized defaults to 401", () => {
    const err = ApiError.unauthorized();
    expect(err.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("tooManyRequests is 429", () => {
    const err = ApiError.tooManyRequests("slow down");
    expect(err.statusCode).toBe(429);
    expect(err.message).toBe("slow down");
  });

  it("conflict is 409", () => {
    const err = ApiError.conflict("duplicate");
    expect(err.statusCode).toBe(409);
  });

  it("notFound is 404", () => {
    const err = ApiError.notFound("missing");
    expect(err.statusCode).toBe(404);
  });

  it("internal is 500", () => {
    const err = ApiError.internal("boom");
    expect(err.statusCode).toBe(500);
  });

  it("serviceUnavailable is 503", () => {
    const err = ApiError.serviceUnavailable("down");
    expect(err.statusCode).toBe(503);
  });

  it("validation includes field details", () => {
    const err = ApiError.validation({ email: ["Required"] });
    expect(err.statusCode).toBe(422);
    expect(err.details?.email).toContain("Required");
  });

  it("is instanceof Error", () => {
    expect(ApiError.badRequest("x")).toBeInstanceOf(Error);
  });
});

describe("errorResponse", () => {
  it("returns JSON with error message and correct status for ApiError", async () => {
    const res = errorResponse(ApiError.badRequest("bad"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad");
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns 422 for ZodError", async () => {
    const schema = z.object({ name: z.string().min(1) });
    let zodErr: z.ZodError | null = null;
    try {
      schema.parse({ name: "" });
    } catch (e) {
      if (e instanceof z.ZodError) zodErr = e;
    }
    const res = errorResponse(zodErr!);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 500 for unknown errors without exposing internals", async () => {
    const res = errorResponse(new Error("secret crash"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("An unexpected error occurred");
  });
});

describe("successResponse", () => {
  it("returns 200 with JSON body by default", async () => {
    const res = successResponse({ ok: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("accepts custom status code", async () => {
    const res = successResponse({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});

describe("validateBody", () => {
  const schema = z.object({ email: z.string().email() });

  it("parses valid body", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const result = await validateBody(req, schema);
    expect(result.email).toBe("a@b.com");
  });

  it("throws ApiError for invalid JSON", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    await expect(validateBody(req, schema)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws validation ApiError for schema mismatch", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    await expect(validateBody(req, schema)).rejects.toMatchObject({
      statusCode: 422,
      code: "VALIDATION_ERROR",
    });
  });
});

describe("zodErrorToApiError", () => {
  it("maps zod field errors to details", () => {
    const schema = z.object({ name: z.string().min(2), age: z.number() });
    let zodErr: z.ZodError | null = null;
    try {
      schema.parse({ name: "x", age: "not-a-number" });
    } catch (e) {
      if (e instanceof z.ZodError) zodErr = e;
    }
    const apiErr = zodErrorToApiError(zodErr!);
    expect(apiErr.statusCode).toBe(422);
    expect(apiErr.details).toBeDefined();
  });
});
