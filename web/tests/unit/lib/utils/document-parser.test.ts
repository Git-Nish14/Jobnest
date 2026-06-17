/**
 * Unit tests for extractAllDocuments — focusing on the extraPaths parameter
 * added so new applications (which no longer write to resume_path /
 * cover_letter_path) still get their documents included in NESTAi context.
 *
 * We mock Supabase storage to return a simple text buffer and use `.txt`
 * paths so the function exercises the full deduplication + type-routing
 * logic without requiring pdf-parse or a real bucket.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractAllDocuments } from "@/lib/utils/document-parser";

// ── Supabase storage stub ─────────────────────────────────────────────────────

function makeBlob(content = "hello world") {
  return new Blob([content], { type: "text/plain" });
}

function makeStorageClient(
  // Map of path → blob (default: return a generic text blob for any path)
  responses: Record<string, Blob | null> = {},
  defaultBlob: Blob | null = makeBlob(),
) {
  const download = vi.fn(async (path: string) => {
    const blob = path in responses ? responses[path] : defaultBlob;
    return blob
      ? { data: blob, error: null }
      : { data: null, error: { message: "not found" } };
  });

  return {
    storage: {
      from: () => ({ download }),
    },
    _download: download, // exposed for assertion
  } as unknown as Parameters<typeof extractAllDocuments>[0] & { _download: typeof download };
}

function makeApp(overrides: Partial<{
  id: string;
  company: string;
  position: string;
  resume_path: string | null;
  cover_letter_path: string | null;
}> = {}) {
  return {
    id: "app-1",
    company: "Acme",
    position: "Engineer",
    resume_path: null,
    cover_letter_path: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Legacy path behaviour (unchanged) ────────────────────────────────────────

describe("extractAllDocuments — legacy resume_path / cover_letter_path", () => {
  it("extracts resume when resume_path is set", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp({ resume_path: "uid/app/Resume/r.txt" })];
    const results = await extractAllDocuments(supabase, apps);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("resume");
    expect(results[0].text).toBe("hello world");
  });

  it("extracts cover letter when cover_letter_path is set", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp({ cover_letter_path: "uid/app/CL/cl.txt" })];
    const results = await extractAllDocuments(supabase, apps);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("cover_letter");
  });

  it("deduplicates apps sharing the same storage path", async () => {
    const supabase = makeStorageClient();
    const path = "uid/shared/resume.txt";
    const apps = [
      makeApp({ id: "a1", resume_path: path }),
      makeApp({ id: "a2", resume_path: path }),
    ];
    const results = await extractAllDocuments(supabase, apps);
    expect(results).toHaveLength(1);
    expect(supabase._download).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when no apps have document paths", async () => {
    const supabase = makeStorageClient();
    const results = await extractAllDocuments(supabase, [makeApp()]);
    expect(results).toHaveLength(0);
  });
});

// ── extraPaths ─────────────────────────────────────────────────────────────────

describe("extractAllDocuments — extraPaths (application_documents rows)", () => {
  it("extracts a resume from extraPaths when resume_path is null", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp()];
    const extraPaths = [{
      applicationId: "app-1",
      company: "Acme",
      position: "Engineer",
      path: "uid/app-1/Resume/r.txt",
      label: "Resume",
    }];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("resume");
    expect(results[0].applicationId).toBe("app-1");
    expect(results[0].text).toBe("hello world");
  });

  it("classifies label containing 'cover' as cover_letter type", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp()];
    const extraPaths = [{
      applicationId: "app-1",
      company: "Acme",
      position: "Engineer",
      path: "uid/app-1/CL/cl.txt",
      label: "Cover Letter",
    }];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("cover_letter");
  });

  it("classifies label not containing 'cover' as resume type", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp()];
    const extraPaths = [{
      applicationId: "app-1",
      company: "Acme",
      position: "Engineer",
      path: "uid/app-1/Portfolio/port.txt",
      label: "Portfolio",
    }];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("resume");
  });

  it("skips an extra path that was already seen via resume_path (no double parse)", async () => {
    const supabase = makeStorageClient();
    const sharedPath = "uid/app-1/Resume/file.txt";
    const apps = [makeApp({ resume_path: sharedPath })];
    const extraPaths = [{
      applicationId: "app-1",
      company: "Acme",
      position: "Engineer",
      path: sharedPath,
      label: "Resume",
    }];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(1);
    expect(supabase._download).toHaveBeenCalledTimes(1);
  });

  it("processes both resume and cover letter extra docs for the same application", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp()];
    const extraPaths = [
      { applicationId: "app-1", company: "Acme", position: "Eng", path: "uid/a/r.txt",  label: "Resume" },
      { applicationId: "app-1", company: "Acme", position: "Eng", path: "uid/a/cl.txt", label: "Cover Letter" },
    ];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.type).sort()).toEqual(["cover_letter", "resume"]);
    expect(supabase._download).toHaveBeenCalledTimes(2);
  });

  it("propagates storage errors as null text without throwing", async () => {
    const supabase = makeStorageClient({ "uid/app-1/bad.txt": null });
    const apps = [makeApp()];
    const extraPaths = [{
      applicationId: "app-1",
      company: "Acme",
      position: "Engineer",
      path: "uid/app-1/bad.txt",
      label: "Resume",
    }];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBeNull();
    expect(results[0].error).toMatch(/download|storage/i);
  });

  it("returns empty array when apps list and extraPaths are both empty", async () => {
    const supabase = makeStorageClient();
    const results = await extractAllDocuments(supabase, [], []);
    expect(results).toHaveLength(0);
    expect(supabase._download).not.toHaveBeenCalled();
  });

  it("mixed: legacy path + separate extra path are both extracted", async () => {
    const supabase = makeStorageClient();
    const apps = [makeApp({ resume_path: "uid/app-1/legacy-resume.txt" })];
    const extraPaths = [{
      applicationId: "app-1",
      company: "Acme",
      position: "Engineer",
      path: "uid/app-1/new-cover.txt",
      label: "Cover Letter",
    }];

    const results = await extractAllDocuments(supabase, apps, extraPaths);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.type === "resume")).toBeDefined();
    expect(results.find((r) => r.type === "cover_letter")).toBeDefined();
  });
});
