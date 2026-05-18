/**
 * Brand icons not included in lucide-react v1+.
 * Using raw SVG paths sourced from the official brand guidelines / simple-icons.
 */
import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ── ATS Provider Icons ────────────────────────────────────────────────────────
// Real SVG paths from simple-icons where confirmed available;
// letter-badge SVGs for the rest.

interface AtsMeta {
  hex: string;
  lightText: boolean;
  chipBg: string;
  chipText: string;
}

const ATS_ICON_META: Record<string, AtsMeta> = {
  "Workday":                { hex: "#0875E1", lightText: true,  chipBg: "bg-[#0875E1]/10", chipText: "text-[#0875E1]" },
  "Lever":                  { hex: "#0ABB87", lightText: true,  chipBg: "bg-[#0ABB87]/10", chipText: "text-[#0ABB87]" },
  "Greenhouse":             { hex: "#24A47F", lightText: true,  chipBg: "bg-[#24A47F]/10", chipText: "text-[#24A47F]" },
  "Ashby":                  { hex: "#6B63FF", lightText: true,  chipBg: "bg-[#6B63FF]/10", chipText: "text-[#6B63FF]" },
  "Oracle (Taleo)":         { hex: "#F80000", lightText: true,  chipBg: "bg-[#F80000]/10", chipText: "text-[#F80000]" },
  "SAP SuccessFactors":     { hex: "#0A6ED1", lightText: true,  chipBg: "bg-[#0A6ED1]/10", chipText: "text-[#0A6ED1]" },
  "iCIMS":                  { hex: "#1B5EAB", lightText: true,  chipBg: "bg-[#1B5EAB]/10", chipText: "text-[#1B5EAB]" },
  "Jobvite":                { hex: "#EF5122", lightText: true,  chipBg: "bg-[#EF5122]/10", chipText: "text-[#EF5122]" },
  "SmartRecruiters":        { hex: "#2B6CB0", lightText: true,  chipBg: "bg-[#2B6CB0]/10", chipText: "text-[#2B6CB0]" },
  "BambooHR":               { hex: "#73C41D", lightText: true,  chipBg: "bg-[#73C41D]/10", chipText: "text-[#73C41D]" },
  "Rippling":               { hex: "#F7C500", lightText: false, chipBg: "bg-[#F7C500]/15", chipText: "text-[#9A7B00]"  },
  "ADP":                    { hex: "#D50032", lightText: true,  chipBg: "bg-[#D50032]/10", chipText: "text-[#D50032]" },
  "Recruiting.com":         { hex: "#005B99", lightText: true,  chipBg: "bg-[#005B99]/10", chipText: "text-[#005B99]" },
  "Company Website Portal": { hex: "#64748B", lightText: true,  chipBg: "bg-slate-500/10",  chipText: "text-slate-600"  },
  "Other":                  { hex: "#94A3B8", lightText: true,  chipBg: "bg-slate-400/10",  chipText: "text-slate-500"  },
};

// Greenhouse — simple-icons path. Brand fill is hardcoded so no inline style needed.
export function GreenhouseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#24A47F" d="M16.279 7.13c0 1.16-.49 2.185-1.293 2.987-.891.891-2.184 1.114-2.184 1.872 0 1.025 1.65.713 3.231 2.295 1.048 1.047 1.694 2.43 1.694 4.034C17.727 21.482 15.187 24 12 24c-3.187 0-5.727-2.518-5.727-5.68 0-1.607.646-2.989 1.694-4.036 1.582-1.582 3.23-1.27 3.23-2.295 0-.758-1.292-.98-2.183-1.872-.802-.802-1.293-1.827-1.293-3.03 0-2.318 1.895-4.19 4.212-4.19.446 0 .847.067 1.181.067.602 0 .914-.268.914-.691 0-.245-.112-.557-.112-.891 0-.758.647-1.382 1.427-1.382s1.404.646 1.404 1.426c0 .825-.647 1.204-1.137 1.382-.401.134-.713.312-.713.713 0 .758 1.382 1.493 1.382 3.61zm-.446 11.19c0-2.206-1.627-3.99-3.833-3.99-2.206 0-3.833 1.784-3.833 3.99 0 2.184 1.627 3.989 3.833 3.989 2.206 0 3.833-1.808 3.833-3.99zM14.518 7.086c0-1.404-1.136-2.562-2.518-2.562S9.482 5.682 9.482 7.086 10.618 9.65 12 9.65s2.518-1.159 2.518-2.563z" />
    </svg>
  );
}

// Oracle — two-oval wordmark shape, color #F80000.
export function OracleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#F80000" d="M16.412 4.412h-8.82a7.588 7.588 0 0 0-.008 15.176h8.828a7.588 7.588 0 0 0 0-15.176zm-.193 12.502H7.786a4.915 4.915 0 0 1 0-9.828h8.433a4.914 4.914 0 1 1 0 9.828z" />
    </svg>
  );
}

// ADP — simple-icons path, color #D50032.
export function AdpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#D50032" d="M15.08584 11.9999a3.13031 3.13031 0 0 1-3.12003 3.12002h-1.2v-1.37144h1.2a1.74859 1.74859 0 1 0 0-3.49717h-1.2V8.87987h1.2a3.13031 3.13031 0 0 1 3.12003 3.12002M8.43436 8.87987v2.53716H6.27434l-.78858 1.37144H9.8058v-3.9086Zm15.56584 1.9543a4.28575 4.28575 0 0 1-4.28575 4.28575v2.33145h-3.70289V15.6342a5.36233 5.36233 0 0 1-4.08003 1.81716H8.43436v-2.33145H5.69148l-1.37144 2.33145H0L6.34291 6.54842h5.6229a5.59548 5.59548 0 0 1 4.08004 1.81716V6.54842h3.70289a4.2789 4.2789 0 0 1 4.25146 4.28575m-12.03439 5.24576a4.09032 4.09032 0 0 0 3.7029-2.33145h1.74858v2.33145h.96v-2.33145h1.37145a2.91088 2.91088 0 0 0 2.9143-2.91431 2.94174 2.94174 0 0 0-2.94859-2.91431H17.383v3.49717h-1.37144a4.11432 4.11432 0 0 0-4.04575-3.49717H7.16577l-4.76575 8.16007h1.13144l1.37144-2.33145h4.9029v2.33145zm7.74864-7.20006h-1.37144v1.37144h1.37144a.57943.57943 0 0 1 .58286.58286.6.6 0 0 1-.58286.58286h-1.37144v1.37144h1.37144a1.9543 1.9543 0 0 0 1.9543-1.9543 1.97487 1.97487 0 0 0-1.9543-1.9543" />
    </svg>
  );
}

// Letter-badge SVG for providers without a dedicated simple-icons entry.
function ProviderLetterBadge({ provider, ...props }: SVGProps<SVGSVGElement> & { provider: string }) {
  const meta = ATS_ICON_META[provider] ?? ATS_ICON_META["Other"];
  const abbr =
    provider === "SAP SuccessFactors"     ? "SAP" :
    provider === "SmartRecruiters"        ? "SR"  :
    provider === "Company Website Portal" ? "WEB" :
    provider === "Recruiting.com"         ? "RC"  :
    provider.charAt(0).toUpperCase();
  const fontSize = abbr.length >= 3 ? 6 : abbr.length === 2 ? 9 : 13;
  const yPos     = abbr.length >= 2 ? 15.5 : 17;
  const textFill = meta.lightText ? "#ffffff" : "#1a1a1a";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect width="24" height="24" rx="5" fill={meta.hex} />
      <text
        x="12" y={yPos}
        textAnchor="middle"
        fill={textFill}
        fontWeight="700"
        fontSize={fontSize}
        fontFamily="system-ui,-apple-system,sans-serif"
      >
        {abbr}
      </text>
    </svg>
  );
}

// Unified icon — picks the real logo when available, falls back to letter badge.
export function AtsProviderIcon({ provider, className }: { provider: string; className?: string }) {
  if (provider === "Greenhouse")     return <GreenhouseIcon className={className} />;
  if (provider === "Oracle (Taleo)") return <OracleIcon     className={className} />;
  if (provider === "ADP")            return <AdpIcon         className={className} />;
  return <ProviderLetterBadge provider={provider} className={className} />;
}

// Inline chip with icon — use in cards and detail views.
export function AtsProviderBadge({ provider, className }: { provider: string; className?: string }) {
  const meta = ATS_ICON_META[provider] ?? ATS_ICON_META["Other"];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium max-w-50",
      meta.chipBg, meta.chipText, className,
    )}>
      <AtsProviderIcon provider={provider} className="h-3 w-3 shrink-0" />
      <span className="truncate">{provider}</span>
    </span>
  );
}
