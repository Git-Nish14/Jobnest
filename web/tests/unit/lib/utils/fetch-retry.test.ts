import { describe, it, expect } from "vitest";
import { getNetworkErrorMessage } from "@/lib/utils/fetch-retry";

describe("getNetworkErrorMessage", () => {
  it("returns connection error for 'Failed to fetch'", () => {
    const msg = getNetworkErrorMessage(new Error("Failed to fetch"));
    expect(msg).toMatch(/connection|internet/i);
  });

  it("returns connection error for NetworkError", () => {
    const msg = getNetworkErrorMessage(new Error("NetworkError when trying to fetch"));
    expect(msg).toMatch(/connection|internet/i);
  });

  it("returns connection error for network request failed", () => {
    const msg = getNetworkErrorMessage(new Error("network request failed"));
    expect(msg).toMatch(/connection|internet/i);
  });

  it("returns connection error for Safari 'Load failed'", () => {
    const msg = getNetworkErrorMessage(new Error("load failed"));
    expect(msg).toMatch(/connection|internet/i);
  });

  it("returns the original message for other errors", () => {
    const msg = getNetworkErrorMessage(new Error("Custom error message"));
    expect(msg).toBe("Custom error message");
  });

  it("returns generic message for non-Error value", () => {
    const msg = getNetworkErrorMessage("string error");
    expect(msg).toMatch(/unexpected error/i);
  });

  it("returns generic message for null", () => {
    const msg = getNetworkErrorMessage(null);
    expect(msg).toMatch(/unexpected error/i);
  });
});
