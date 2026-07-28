/**
 * Unit tests — actions/auth.ts
 *
 * Covers signOutAction:
 *   - Default scope is "global"
 *   - "local" scope is passed through unchanged
 *   - Runtime scope guard: any value other than "local" is clamped to "global"
 *     (TypeScript union types are erased at runtime; a crafted POST to the
 *     server-action endpoint could supply "others", which is a valid Supabase
 *     scope that signs out all sessions *except* the caller's.  The guard
 *     closes that attack surface.)
 *   - redirect("/login") is always called after signOut
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { signOutAction } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const mockCreateClient = vi.mocked(createClient);
const mockRedirect     = vi.mocked(redirect);

function makeSupabase() {
  return { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } };
}

describe("signOutAction", () => {
  let supabase: ReturnType<typeof makeSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase as never);
  });

  it("passes scope 'global' by default (no argument)", async () => {
    await signOutAction();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("passes scope 'global' when called with 'global'", async () => {
    await signOutAction("global");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("passes scope 'local' when called with 'local'", async () => {
    await signOutAction("local");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  // ── Runtime scope guard ───────────────────────────────────────────────────
  // Supabase accepts "others" (revokes every session except the caller's).
  // A crafted request could exploit this to lock the account owner out while
  // the attacker keeps access.  The guard must clamp any unknown value to
  // "global" so the caller is always signed out too.

  it("clamps 'others' to 'global' (scope injection attack vector)", async () => {
    await signOutAction("others" as never);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("clamps arbitrary unknown scope strings to 'global'", async () => {
    for (const bad of ["all", "everyone", "", "ALL", "GLOBAL"]) {
      vi.clearAllMocks();
      supabase = makeSupabase();
      mockCreateClient.mockResolvedValue(supabase as never);
      await signOutAction(bad as never);
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    }
  });

  it("redirects to /login after signing out", async () => {
    await signOutAction("global");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login even for local scope", async () => {
    await signOutAction("local");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
