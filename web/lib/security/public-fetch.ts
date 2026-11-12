import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import type { LookupFunction } from "node:net";

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["192.88.99.0", 24],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");

const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
blockedV6.addSubnet("2001::", 23, "ipv6"); // Special-purpose and transition ranges.
blockedV6.addSubnet("2001:db8::", 32, "ipv6");
blockedV6.addSubnet("2002::", 16, "ipv6"); // 6to4 can embed a private IPv4 address.
blockedV6.addSubnet("3fff::", 20, "ipv6"); // Documentation.

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  // Only global unicast. This also rejects IPv4-mapped IPv6 and local/NAT64 ranges.
  return family === 6 && globalV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
}

/** Download an untrusted URL with connection-time DNS pinning and bounded buffering. */
export async function fetchPublicUrl(
  rawUrl: string,
  { maxBytes, timeoutMs, headers = {} }: {
    maxBytes: number;
    timeoutMs: number;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL(rawUrl);
  for (let redirects = 0; redirects <= 5; redirects++) {
    signal.throwIfAborted();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Only public HTTP and HTTPS URLs are supported.");
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    // Resolve once per hop; the request's lookup cannot resolve a different address.
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await Promise.race([
          lookup(hostname, { all: true }),
          new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
        ]);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new Error("The URL must resolve only to public network addresses.");
    }
    signal.throwIfAborted();
    const address = addresses[0];
    const pinnedLookup: LookupFunction = (_host, options, callback) => {
      if (options.all) callback(null, [{ address: address.address, family: address.family }]);
      else callback(null, address.address, address.family);
    };
    const result = await new Promise<{ response?: Response; redirect?: string }>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
        method: "GET", signal, lookup: pinnedLookup, agent: false,
        headers: { ...headers, "Accept-Encoding": "identity" },
      }, (incoming) => {
        const status = incoming.statusCode ?? 502;
        incoming.on("error", reject);
        if ([301, 302, 303, 307, 308].includes(status) && incoming.headers.location) {
          resolve({ redirect: incoming.headers.location });
          incoming.destroy();
          return;
        }
        const length = Number(incoming.headers["content-length"]);
        if (Number.isFinite(length) && length > maxBytes) {
          reject(new Error("Remote file exceeds the download size limit."));
          incoming.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        incoming.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            reject(new Error("Remote file exceeds the download size limit."));
            incoming.destroy();
          } else chunks.push(chunk);
        });
        incoming.on("aborted", () => reject(new Error("Remote download was interrupted.")));
        incoming.on("end", () => {
          try {
            const responseHeaders = new Headers();
            for (const [name, value] of Object.entries(incoming.headers)) {
              if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
            }
            const body = [204, 205, 304].includes(status) ? null : new Uint8Array(Buffer.concat(chunks));
            resolve({ response: new Response(body, { status, headers: responseHeaders }) });
          } catch (error) { reject(error); }
        });
      });
      request.on("error", reject);
      request.end();
    });
    if (result.response) return result.response;
    url = new URL(result.redirect!, url);
  }
  throw new Error("Too many redirects.");
}
