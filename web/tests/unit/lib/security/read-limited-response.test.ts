import { describe, expect, it, vi } from "vitest";
import { readLimitedResponse } from "@/lib/security/read-limited-response";

describe("bounded response reading", () => {
  it("accepts bytes up to the inclusive limit", async () => {
    expect((await readLimitedResponse(new Response("hello"), 5)).toString()).toBe("hello");
  });
  it("cancels a chunked stream when the actual byte count exceeds the limit", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.enqueue(new Uint8Array(4));
      }, cancel,
    });
    await expect(readLimitedResponse(new Response(body), 5)).rejects.toThrow(/size limit/);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
