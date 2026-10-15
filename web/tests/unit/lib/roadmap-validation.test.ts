import { describe, it, expect } from "vitest";
import { equitySchema } from "@/lib/validations/equity";
import { computeVestingSchedule } from "@/lib/utils/salary-helpers";
import { describeIndex, INDEX_FRESHNESS_MS } from "@/lib/features/index-status";
import { readJsonBody } from "@/lib/api/read-json";

const equity = { total_shares: 101, current_price: 1.25, cliff_months: 12, vest_months: 48, grant_date: "2026-10-15" };
describe("equity validation and estimates", () => {
  it.each([{ cliff_months: 49 }, { total_shares: 0 }, { current_price: -1 }, { vest_months: 0 },
    { vest_months: 1.5 }, { grant_date: "2026-02-30" }, { total_shares: Infinity }, { current_price: NaN }, { user_id: "other" }])("rejects invalid equity %j", input => {
    expect(equitySchema.safeParse({ ...equity, ...input }).success).toBe(false);
  });
  it("accepts zero price and no cliff", () => expect(equitySchema.safeParse({ ...equity, cliff_months: 0, current_price: 0 }).success).toBe(true));
  it("retains fractional shares and their value", () => {
    const rows = computeVestingSchedule(equity);
    expect(rows.map(row => row.sharesVested)).toEqual([25.25, 25.25, 25.25, 25.25]);
    expect(rows[0].value).toBe(31.56);
  });
  it("handles zero cliff, full cliff and periods shorter than four years", () => {
    expect(computeVestingSchedule({ ...equity, cliff_months: 0, vest_months: 24 }).map(row => row.sharesVested)).toEqual([50.5, 50.5, 0, 0]);
    expect(computeVestingSchedule({ ...equity, cliff_months: 24, vest_months: 24 }).map(row => row.sharesVested)).toEqual([0, 101, 0, 0]);
  });
  it("returns no estimate for invalid legacy data", () => expect(computeVestingSchedule({ ...equity, vest_months: 0 })).toEqual([]));
});
describe("index status", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  it("distinguishes empty indexes from unavailable counts", () => {
    expect(describeIndex(0, null, false, now).status).toBe("empty");
    expect(describeIndex(null, null, true, now)).toMatchObject({ status: "unavailable", embeddingCount: null });
    expect(describeIndex(10, "invalid", false, now).status).toBe("unavailable");
  });
  it("uses the two-hour refresh threshold", () => {
    expect(describeIndex(12, new Date(now - INDEX_FRESHNESS_MS + 1).toISOString(), false, now).status).toBe("recent");
    expect(describeIndex(12, new Date(now - INDEX_FRESHNESS_MS).toISOString(), false, now).status).toBe("stale");
  });
});
describe("bounded JSON requests", () => {
  const request = (body: string, headers = {}) => new Request("http://localhost", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
  it("parses valid JSON", async () => expect(await readJsonBody(request('{"hello":1}'), 20)).toEqual({ hello: 1 }));
  it("rejects malformed JSON", async () => expect(readJsonBody(request("bad"))).rejects.toMatchObject({ statusCode: 400 }));
  it("rejects unsupported media types", async () => expect(readJsonBody(request("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ statusCode: 415 }));
  it("rejects oversized content length", async () => expect(readJsonBody(request("{}", { "content-length": "100" }), 10)).rejects.toMatchObject({ statusCode: 413 }));
  it("counts actual UTF-8 bytes even with an understated length", async () => expect(readJsonBody(request('"🪺🪺"', { "content-length": "1" }), 5)).rejects.toMatchObject({ statusCode: 413 }));
});
