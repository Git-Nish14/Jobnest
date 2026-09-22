import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue({ auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }) } } as never);
});

describe("social login return to plugin consent", () => {
  it("returns to the original consent request after session exchange", async () => {
    const next = "/integrations/chatgpt/authorize?request=opaque";
    const response = await GET(new NextRequest(`https://jobnest.example.com/auth/callback?code=test&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe(`https://jobnest.example.com${next}`);
  });
  it("cannot redirect the authorization code flow to an external site", async () => {
    const response = await GET(new NextRequest("https://jobnest.example.com/auth/callback?code=test&next=%2F%2Fevil.example"));
    expect(response.headers.get("location")).toBe("https://jobnest.example.com/dashboard");
  });
});
