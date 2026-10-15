import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { ApiError } from "@/lib/api/errors";

export const ENDORSEMENT_COOKIE = "jobnest_endorser";
export const ENDORSEMENT_COOKIE_PATH = "/api/public/portfolios";

export function endorsementIdentity(request: Request) {
  const secret = process.env.CSRF_SECRET || (process.env.NODE_ENV !== "production" ? "local-endorsement-secret" : "");
  if (secret.length < 24) throw ApiError.serviceUnavailable("Endorsements are temporarily unavailable.");
  const digest = (domain: string, value: string) => createHmac("sha256", secret).update(`${domain}:${value}`).digest("hex");
  // Vercel overwrites this header. Other deployments must explicitly trust an
  // ingress that overwrites x-real-ip and prevents direct access to the origin.
  const address = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")
    : process.env.ENDORSEMENTS_TRUST_PROXY === "1" ? request.headers.get("x-real-ip")
    : process.env.NODE_ENV !== "production" ? "127.0.0.1" : null;
  if (!address || !isIP(address.trim())) throw ApiError.serviceUnavailable("Endorsements are temporarily unavailable.");
  // URL canonicalizes equivalent IPv6 spellings before hashing; IPv4 mapped IPv6
  // is reduced to IPv4 so changing textual representation cannot create votes.
  let ip = address.trim();
  if (isIP(ip) === 6) {
    ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/i.exec(ip);
    if (mapped) {
      const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
      ip = `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
    } else {
      // Limit IPv6 address rotation within a single /64 allocation.
      const halves = ip.split("::");
      const left = halves[0] ? halves[0].split(":") : [];
      const right = halves[1] ? halves[1].split(":") : [];
      const full = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
      ip = full.slice(0, 4).map(part => part.padStart(4, "0")).join(":") + "::/64";
    }
  }
  const cookie = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${ENDORSEMENT_COOKIE}=`))?.slice(ENDORSEMENT_COOKIE.length + 1);
  const parts = cookie?.split(".");
  let visitor: string;
  if (parts?.length === 2 && /^[a-f0-9]{64}$/.test(parts[0]) && /^[a-f0-9]{64}$/.test(parts[1])
    && timingSafeEqual(Buffer.from(parts[1], "hex"), Buffer.from(digest("cookie", parts[0]), "hex"))) visitor = parts[0];
  else visitor = randomBytes(32).toString("hex");
  return { visitorHash: digest("visitor", visitor), networkHash: digest("network", ip), cookie: `${visitor}.${digest("cookie", visitor)}` };
}
