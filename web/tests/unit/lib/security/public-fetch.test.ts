import { EventEmitter } from "node:events";
import type { LookupFunction } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:http", () => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { fetchPublicUrl, isPublicAddress } from "@/lib/security/public-fetch";

const settings = { maxBytes: 100, timeoutMs: 1000 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
});

function respond(status = 200, headers = {}, chunks = [Buffer.from("hello")]) {
  vi.mocked(request).mockImplementationOnce((_url, _options, callback) => {
    const incoming = Object.assign(new EventEmitter(), {
      statusCode: status, headers, destroy: vi.fn(),
    });
    return Object.assign(new EventEmitter(), {
      end: () => queueMicrotask(() => {
        callback!(incoming as never);
        if (!incoming.destroy.mock.calls.length) {
          for (const chunk of chunks) incoming.emit("data", chunk);
          incoming.emit("end");
        }
      }),
    }) as never;
  });
}

describe("public URL downloads", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2002:7f00:1::", "2001:db8::1"])("rejects %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("accepts public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it("rejects a hostname with even one private DNS answer before opening a connection", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }] as never);
    await expect(fetchPublicUrl("https://files.example/file", settings)).rejects.toThrow(/public/);
    expect(request).not.toHaveBeenCalled();
  });

  it("pins connection lookup to the checked DNS answer", async () => {
    respond();
    expect(await (await fetchPublicUrl("https://files.example/file", settings)).text()).toBe("hello");
    const options = vi.mocked(request).mock.calls[0][1] as { lookup: LookupFunction };
    const callback = vi.fn();
    options.lookup("files.example", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(lookup).toHaveBeenCalledOnce();
  });

  it("validates a redirect destination before making its request", async () => {
    respond(302, { location: "http://127.0.0.1/private" });
    await expect(fetchPublicUrl("https://files.example/file", settings)).rejects.toThrow(/public/);
    expect(request).toHaveBeenCalledOnce();
  });

  it("stops an oversized chunked response without Content-Length", async () => {
    respond(200, {}, [Buffer.alloc(60), Buffer.alloc(60)]);
    await expect(fetchPublicUrl("https://files.example/file", settings)).rejects.toThrow(/size limit/);
  });

  it("rejects unsupported upstream status codes through the promise", async () => {
    respond(700);
    await expect(fetchPublicUrl("https://files.example/file", settings)).rejects.toThrow();
  });
});
