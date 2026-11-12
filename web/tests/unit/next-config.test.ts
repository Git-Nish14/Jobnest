import { createRequire } from "node:module";
import type { NextConfig } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs/config", () => ({
  withSentryConfig: (config: unknown) => config,
}));
vi.mock("@next/bundle-analyzer", () => ({
  default: () => (config: unknown) => config,
}));

type Redirect = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];
const { convertRedirects } = createRequire(import.meta.url)(
  "next/dist/compiled/@vercel/routing-utils",
) as {
  convertRedirects: (redirects: Redirect[]) => {
    headers: { Location: string };
    status: number;
  }[];
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("HTTPS redirect configuration", () => {
  it("compiles the host capture with the route compiler used by Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: config } = await import("../../next.config");
    const redirects = await config.redirects!();
    expect(redirects).toHaveLength(1);
    expect(redirects[0].has).toContainEqual({ type: "host", value: "(?<host>.+)" });
    expect(redirects[0].has).toContainEqual({
      type: "header", key: "x-forwarded-proto", value: "http",
    });
    expect(convertRedirects(redirects)).toMatchObject([
      { status: 308, headers: { Location: "https://$host/$1" } },
    ]);
  });

  it("reproduces the Vercel failure if the host capture is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: config } = await import("../../next.config");
    const redirects = await config.redirects!();
    const invalid = redirects.map((redirect) => ({
      ...redirect,
      has: redirect.has?.filter((condition) => condition.type !== "host"),
    }));
    expect(() => convertRedirects(invalid)).toThrow("Failed to parse redirect");
  });

  it("does not force HTTPS in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { default: config } = await import("../../next.config");
    expect(await config.redirects!()).toEqual([]);
  });
});
