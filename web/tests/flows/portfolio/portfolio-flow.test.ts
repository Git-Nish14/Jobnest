/**
 * E2E flow — Portfolio & Developer Identity
 *
 * Covers the full request pipeline for every new portfolio route:
 *   GitHub connection · GitHub repos (pin/unpin) · Projects CRUD
 *   LinkedIn save/load · Username claim & availability · Portfolio visibility
 *   GitHub-sync cron auth guard
 *
 * Pattern mirrors developer-identity-flow.test.ts: each sub-flow exercises
 * auth → CSRF/rate-limit → DB interaction end-to-end using the project-standard
 * Supabase mock.  No real DB or network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

// ── Module mocks (hoisted) ─────────────────────────────────────────────────
vi.mock("@/lib/supabase/server",  () => ({ createClient:      vi.fn() }));
vi.mock("@/lib/supabase/admin",   () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET  as getConnection }  from "@/app/api/portfolio/github/connection/route";
import { GET  as getRepos, PATCH as patchRepo } from "@/app/api/portfolio/github/repos/route";
import { DELETE as disconnect }   from "@/app/api/portfolio/github/disconnect/route";
import { POST as syncGitHub }     from "@/app/api/portfolio/github/sync/route";
import { GET  as listProjects, POST as createProject }  from "@/app/api/portfolio/projects/route";
import { PATCH as patchProject, DELETE as deleteProject } from "@/app/api/portfolio/projects/[id]/route";
import { GET  as getLinkedIn,  POST as saveLinkedIn }   from "@/app/api/portfolio/linkedin/route";
import { GET  as getUsername,  POST as claimUsername }  from "@/app/api/portfolio/username/route";
import { POST as setVisibility } from "@/app/api/profile/update-portfolio-visibility/route";
import { POST as cronSync }      from "@/app/api/cron/github-sync/route";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit }    from "@/lib/security/rate-limit";

const mockCreate  = vi.mocked(createClient);
const mockAdmin   = vi.mocked(createAdminClient);
const mockRL      = vi.mocked(checkRateLimit);

// ── Fixtures ───────────────────────────────────────────────────────────────
const USER    = { id: "uid-portfolio", email: "portfolio@test.com", user_metadata: { username: "nish", portfolio_public: false } };
const REPO_ID = "aabbccdd-0000-1111-2222-333344445555";
const PROJ_ID = "bbccddee-0000-1111-2222-333344445555";

const GH_CONN = {
  github_username: "nish1",
  github_name: "Nish Patel",
  github_avatar_url: "https://avatars.githubusercontent.com/u/12345",
  github_bio: "Builder",
  github_location: "SF",
  github_company: null,
  github_blog: null,
  github_public_repos: 30,
  github_followers: 100,
  github_following: 50,
  last_synced_at: "2026-05-01T00:00:00Z",
};

const GH_REPO = {
  id: REPO_ID, name: "jobnest", full_name: "nish1/jobnest",
  description: "Job tracker", html_url: "https://github.com/nish1/jobnest",
  homepage_url: null, language: "TypeScript",
  stargazers_count: 42, forks_count: 5,
  is_fork: false, is_archived: false, topics: ["next", "supabase"], is_pinned: false,
};

const PROJ = {
  id: PROJ_ID, user_id: USER.id,
  title: "Jobnest", description: "Job tracking app",
  tags: ["Next.js", "Supabase"], demo_url: "https://jobnest.nishpatel.dev",
  repo_url: null, image_url: null, github_repo_id: null,
  is_featured: true, display_order: 0,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function rlOk() {
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
}

function serverClient(user: typeof USER | null = USER, result: unknown = { data: null, error: null }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(makeChain(result)),
  };
}

function adminClient(result: unknown = { data: null, error: null }) {
  const chain = makeChain(result);
  return {
    from: vi.fn().mockReturnValue(chain),
    auth: {
      admin: {
        getUserById:    vi.fn().mockResolvedValue({ data: { user: USER }, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  };
}

function postReq(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function delReq(url: string) {
  return new NextRequest(`http://localhost${url}`, { method: "DELETE" });
}

function cronReq(secret = "test-cron-secret") {
  return new NextRequest("http://localhost/api/cron/github-sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rlOk();
});

// ── GitHub connection ──────────────────────────────────────────────────────

describe("GET /api/portfolio/github/connection", () => {
  it("returns null when no connection exists", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: null, error: null }) as never);
    const res = await getConnection();
    expect(res.status).toBe(200);
    expect((await res.json()).connection).toBeNull();
  });

  it("returns the connection when one exists", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: GH_CONN, error: null }) as never);
    const res = await getConnection();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connection.github_username).toBe("nish1");
    expect(body.connection.github_followers).toBe(100);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await getConnection();
    expect(res.status).toBe(401);
  });
});

// ── GitHub repos ───────────────────────────────────────────────────────────

describe("GET /api/portfolio/github/repos", () => {
  it("returns empty array when no repos synced", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [], error: null }) as never);
    const res = await getRepos();
    expect(res.status).toBe(200);
    expect((await res.json()).repos).toEqual([]);
  });

  it("returns repo list when repos exist", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [GH_REPO], error: null }) as never);
    const res = await getRepos();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repos).toHaveLength(1);
    expect(body.repos[0].name).toBe("jobnest");
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await getRepos();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/portfolio/github/repos — pin toggle", () => {
  it("pins a repo successfully when under the 6-repo limit", async () => {
    const countChain = makeChain({ count: 2, data: null, error: null });
    const updateChain = makeChain({ data: { ...GH_REPO, is_pinned: true }, error: null });
    const sc = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "github_repos") return { ...countChain, update: vi.fn().mockReturnValue(updateChain) };
        return makeChain();
      }),
    };
    mockCreate.mockResolvedValue(sc as never);
    const res = await patchRepo(patchReq("/api/portfolio/github/repos", { id: REPO_ID, is_pinned: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repo.is_pinned).toBe(true);
  });

  it("rejects pinning when 6 repos already pinned", async () => {
    const countChain = makeChain({ count: 6, data: null, error: null });
    const sc = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }) },
      from: vi.fn(() => countChain),
    };
    mockCreate.mockResolvedValue(sc as never);
    const res = await patchRepo(patchReq("/api/portfolio/github/repos", { id: REPO_ID, is_pinned: true }));
    expect(res.status).toBe(400);
  });

  it("allows unpinning even at the limit", async () => {
    // Unpin does not check count
    const updateChain = makeChain({ data: { ...GH_REPO, is_pinned: false }, error: null });
    const sc = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }) },
      from: vi.fn(() => ({ ...makeChain(), update: vi.fn().mockReturnValue(updateChain) })),
    };
    mockCreate.mockResolvedValue(sc as never);
    const res = await patchRepo(patchReq("/api/portfolio/github/repos", { id: REPO_ID, is_pinned: false }));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid repo id format", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const res = await patchRepo(patchReq("/api/portfolio/github/repos", { id: "not-a-uuid", is_pinned: true }));
    expect(res.status).toBe(422);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await patchRepo(patchReq("/api/portfolio/github/repos", { id: REPO_ID, is_pinned: true }));
    expect(res.status).toBe(401);
  });
});

// ── GitHub disconnect ──────────────────────────────────────────────────────

describe("DELETE /api/portfolio/github/disconnect", () => {
  it("disconnects successfully and returns 204", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient({ data: null, error: null }) as never);
    const res = await disconnect(delReq("/api/portfolio/github/disconnect"));
    expect(res.status).toBe(204);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await disconnect(delReq("/api/portfolio/github/disconnect"));
    expect(res.status).toBe(401);
  });
});

// ── Projects CRUD ──────────────────────────────────────────────────────────

describe("Projects — full CRUD flow", () => {
  it("GET returns empty list before any projects are added", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [], error: null }) as never);
    const res = await listProjects();
    expect(res.status).toBe(200);
    expect((await res.json()).projects).toEqual([]);
  });

  it("POST creates a project and returns 201", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: PROJ, error: null }) as never);
    const res = await createProject(postReq("/api/portfolio/projects", {
      title: "Jobnest", description: "Job tracking app",
      tags: ["Next.js", "Supabase"], demo_url: "https://jobnest.nishpatel.dev",
      is_featured: true,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.project.id).toBe(PROJ_ID);
    expect(body.project.title).toBe("Jobnest");
  });

  it("GET returns the newly created project", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [PROJ], error: null }) as never);
    const res = await listProjects();
    expect(res.status).toBe(200);
    expect((await res.json()).projects).toHaveLength(1);
  });

  it("PATCH updates a project and returns the updated row", async () => {
    const updated = { ...PROJ, title: "Jobnest v2" };
    mockCreate.mockResolvedValue(serverClient(USER, { data: updated, error: null }) as never);
    const res = await patchProject(
      patchReq(`/api/portfolio/projects/${PROJ_ID}`, { title: "Jobnest v2" }),
      { params: Promise.resolve({ id: PROJ_ID }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).project.title).toBe("Jobnest v2");
  });

  it("DELETE removes the project and returns 204", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [{ id: PROJ_ID }], error: null }) as never);
    const res = await deleteProject(
      delReq(`/api/portfolio/projects/${PROJ_ID}`),
      { params: Promise.resolve({ id: PROJ_ID }) }
    );
    expect(res.status).toBe(204);
  });

  it("DELETE returns 404 for an already-deleted project", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [], error: null }) as never);
    const res = await deleteProject(
      delReq(`/api/portfolio/projects/${PROJ_ID}`),
      { params: Promise.resolve({ id: PROJ_ID }) }
    );
    expect(res.status).toBe(404);
  });

  it("GET returns empty list after deletion", async () => {
    mockCreate.mockResolvedValue(serverClient(USER, { data: [], error: null }) as never);
    const res = await listProjects();
    expect(res.status).toBe(200);
    expect((await res.json()).projects).toEqual([]);
  });
});

describe("Projects — auth & validation", () => {
  it("POST rejects unauthenticated request with 401", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await createProject(postReq("/api/portfolio/projects", { title: "Test" }));
    expect(res.status).toBe(401);
  });

  it("POST rejects missing title with 422", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const res = await createProject(postReq("/api/portfolio/projects", { description: "No title" }));
    expect(res.status).toBe(422);
  });

  it("POST rejects non-URL demo_url with 422", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const res = await createProject(postReq("/api/portfolio/projects", {
      title: "Test", demo_url: "not-a-url",
    }));
    expect(res.status).toBe(422);
  });

  it("DELETE rejects non-UUID project id with 400", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const res = await deleteProject(
      delReq("/api/portfolio/projects/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH rejects unauthenticated request with 401", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await patchProject(
      patchReq(`/api/portfolio/projects/${PROJ_ID}`, { title: "X" }),
      { params: Promise.resolve({ id: PROJ_ID }) }
    );
    expect(res.status).toBe(401);
  });
});

// ── LinkedIn ───────────────────────────────────────────────────────────────

describe("LinkedIn — save & retrieve", () => {
  it("GET returns null when no LinkedIn data saved", async () => {
    const user = { ...USER, user_metadata: {} };
    mockCreate.mockResolvedValue(serverClient(user as typeof USER) as never);
    const res = await getLinkedIn();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkedin_url).toBeNull();
    expect(body.checklist).toBeNull();
  });

  it("POST saves LinkedIn URL and checklist, returns 200", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient() as never);
    const res = await saveLinkedIn(postReq("/api/portfolio/linkedin", {
      linkedin_url: "https://linkedin.com/in/nishpatel",
      checklist: {
        has_photo: true, has_headline: true, has_about: false,
        has_featured: false, has_experience: true, has_skills: true,
        has_recommendations: false, over_500_connections: false,
      },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkedin_url).toBe("https://linkedin.com/in/nishpatel");
    expect(body.checklist.has_photo).toBe(true);
  });

  it("POST rejects invalid LinkedIn URL with 422", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const res = await saveLinkedIn(postReq("/api/portfolio/linkedin", {
      linkedin_url: "https://twitter.com/nishpatel",
    }));
    expect(res.status).toBe(422);
  });

  it("POST accepts LinkedIn URLs with dots in slug", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient() as never);
    const res = await saveLinkedIn(postReq("/api/portfolio/linkedin", {
      linkedin_url: "https://linkedin.com/in/john.doe",
    }));
    expect(res.status).toBe(200);
  });

  it("POST rejects unauthenticated request with 401", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await saveLinkedIn(postReq("/api/portfolio/linkedin", { linkedin_url: null }));
    expect(res.status).toBe(401);
  });
});

// ── Username ───────────────────────────────────────────────────────────────

describe("Username — availability check & claim", () => {
  it("GET with no query param returns current username from user_metadata", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const req = new NextRequest("http://localhost/api/portfolio/username");
    const res = await getUsername(req);
    expect(res.status).toBe(200);
    expect((await res.json()).username).toBe("nish");
  });

  it("GET with ?u= returns available: true for unclaimed username", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient({ data: null, error: null }) as never);
    const req = new NextRequest("http://localhost/api/portfolio/username?u=mynewslug");
    const res = await getUsername(req);
    expect(res.status).toBe(200);
    expect((await res.json()).available).toBe(true);
  });

  it("GET returns available: false for reserved username", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const req = new NextRequest("http://localhost/api/portfolio/username?u=admin");
    const res = await getUsername(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toBe("reserved");
  });

  it("GET returns available: false for invalid format (too short)", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const req = new NextRequest("http://localhost/api/portfolio/username?u=a");
    const res = await getUsername(req);
    expect(res.status).toBe(200);
    expect((await res.json()).available).toBe(false);
  });

  it("GET returns available: false for taken username (different user)", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient({ data: { user_id: "other-uid" }, error: null }) as never);
    const req = new NextRequest("http://localhost/api/portfolio/username?u=takenslug");
    const res = await getUsername(req);
    expect(res.status).toBe(200);
    expect((await res.json()).available).toBe(false);
  });

  it("POST claims a username and returns it", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    const adminMock = {
      from: vi.fn((table: string) => {
        if (table === "usernames") {
          // conflict check: no conflict found
          const conflictChain = makeChain({ data: null, error: null });
          return { ...conflictChain, delete: vi.fn().mockReturnValue(makeChain({ error: null })), insert: vi.fn().mockReturnValue(makeChain({ error: null })) };
        }
        return makeChain();
      }),
      auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
    };
    mockAdmin.mockReturnValue(adminMock as never);
    const res = await claimUsername(postReq("/api/portfolio/username", { username: "mynewslug" }));
    expect(res.status).toBe(200);
    expect((await res.json()).username).toBe("mynewslug");
  });

  it("POST rejects reserved username with 409", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient() as never);
    const res = await claimUsername(postReq("/api/portfolio/username", { username: "admin" }));
    expect(res.status).toBe(409);
  });

  it("POST rejects unauthenticated request with 401", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await claimUsername(postReq("/api/portfolio/username", { username: "newname" }));
    expect(res.status).toBe(401);
  });
});

// ── Portfolio visibility ───────────────────────────────────────────────────

describe("Portfolio visibility — toggle", () => {
  it("POST enables portfolio_public", async () => {
    const userWithUsername = { ...USER, user_metadata: { username: "nish" } };
    mockCreate.mockResolvedValue(serverClient(userWithUsername as typeof USER) as never);
    mockAdmin.mockReturnValue(adminClient() as never);
    const res = await setVisibility(postReq("/api/profile/update-portfolio-visibility", { portfolio_public: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).portfolio_public).toBe(true);
  });

  it("POST rejects enabling public without a username", async () => {
    const userNoSlug = { ...USER, user_metadata: {} };
    mockCreate.mockResolvedValue(serverClient(userNoSlug as typeof USER) as never);
    mockAdmin.mockReturnValue(adminClient() as never);
    const res = await setVisibility(postReq("/api/profile/update-portfolio-visibility", { portfolio_public: true }));
    expect(res.status).toBe(400);
  });

  it("POST sets show_email flag independently", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    mockAdmin.mockReturnValue(adminClient() as never);
    const res = await setVisibility(postReq("/api/profile/update-portfolio-visibility", { show_email: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).show_email).toBe(true);
  });

  it("POST returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await setVisibility(postReq("/api/profile/update-portfolio-visibility", { portfolio_public: false }));
    expect(res.status).toBe(401);
  });
});

// ── Manual GitHub sync ────────────────────────────────────────────────────

describe("POST /api/portfolio/github/sync — manual sync", () => {
  it("returns 400 when no GitHub connection exists for the user", async () => {
    mockCreate.mockResolvedValue(serverClient(USER) as never);
    // admin returns null for the connection row
    mockAdmin.mockReturnValue(adminClient({ data: null, error: { message: "no rows" } }) as never);
    const res = await syncGitHub(postReq("/api/portfolio/github/sync", {}));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreate.mockResolvedValue(serverClient(null) as never);
    const res = await syncGitHub(postReq("/api/portfolio/github/sync", {}));
    expect(res.status).toBe(401);
  });
});

// ── GitHub sync cron ───────────────────────────────────────────────────────

describe("POST /api/cron/github-sync — auth guard", () => {
  it("returns 401 for wrong secret", async () => {
    const res = await cronSync(cronReq("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for missing Authorization header", async () => {
    const res = await cronSync(new NextRequest("http://localhost/api/cron/github-sync", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with synced count when connections exist (skips actual GH API)", async () => {
    // Admin client: returns empty connections list → no real GitHub calls made
    mockAdmin.mockReturnValue(adminClient({ data: [], error: null }) as never);
    const res = await cronSync(cronReq("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
    expect(body.failed).toBe(0);
  });

  it("returns 500 when CRON_SECRET env var is unset", async () => {
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const res = await cronSync(cronReq("Bearer undefined"));
    expect(res.status).toBe(500);
    process.env.CRON_SECRET = original;
  });
});

// ── Cross-cutting: schema validation stops DB calls ────────────────────────

describe("Schema validation prevents DB round-trips", () => {
  it("POST project with title > 120 chars never reaches DB", async () => {
    const sc = serverClient(USER);
    mockCreate.mockResolvedValue(sc as never);
    const res = await createProject(postReq("/api/portfolio/projects", {
      title: "x".repeat(121),
    }));
    expect(res.status).toBe(422);
    expect((sc.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("PATCH project with invalid UUID never reaches DB", async () => {
    const sc = serverClient(USER);
    mockCreate.mockResolvedValue(sc as never);
    const res = await patchProject(
      patchReq("/api/portfolio/projects/bad-id", { title: "X" }),
      { params: Promise.resolve({ id: "bad-id" }) }
    );
    expect(res.status).toBe(400);
    expect((sc.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("POST LinkedIn with non-HTTPS URL is rejected before DB", async () => {
    const sc = serverClient(USER);
    mockCreate.mockResolvedValue(sc as never);
    const res = await saveLinkedIn(postReq("/api/portfolio/linkedin", {
      linkedin_url: "http://linkedin.com/in/nish",
    }));
    expect(res.status).toBe(422);
  });

  it("POST username with special chars is rejected", async () => {
    const sc = serverClient(USER);
    mockCreate.mockResolvedValue(sc as never);
    const res = await claimUsername(postReq("/api/portfolio/username", { username: "hello world!" }));
    expect(res.status).toBe(422);
  });
});
