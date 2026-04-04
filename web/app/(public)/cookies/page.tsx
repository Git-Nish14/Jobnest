import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "A full list of every cookie Jobnest sets, its purpose, type, and duration.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#dbc1b9]/20 pb-8 last:border-0">
      <h2 className="landing-serif text-xl sm:text-2xl font-semibold text-[#1a1c1b] mb-4">{title}</h2>
      {children}
    </section>
  );
}

interface CookieRow {
  name: string;
  purpose: string;
  type: "Essential" | "Preference" | "Analytics";
  duration: string;
  setBy: string;
}

function CookieTable({ rows }: { rows: CookieRow[] }) {
  const typeColour: Record<CookieRow["type"], string> = {
    Essential: "bg-[#99462a]/10 text-[#99462a]",
    Preference: "bg-amber-100 text-amber-700",
    Analytics: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#f4f3f1]">
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Name</th>
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Purpose</th>
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Type</th>
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Duration</th>
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Set by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "" : "bg-[#f4f3f1]/50"}>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top">
                <code className="font-mono text-xs bg-[#f4f3f1] px-1.5 py-0.5 rounded">{row.name}</code>
              </td>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top text-[#55433d]">{row.purpose}</td>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColour[row.type]}`}>
                  {row.type}
                </span>
              </td>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top text-[#55433d] whitespace-nowrap">{row.duration}</td>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top text-[#55433d]">{row.setBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SESSION_COOKIES: CookieRow[] = [
  {
    name: "sb-<ref>-auth-token",
    purpose: "Stores your Supabase authentication session JWT. Required to keep you signed in.",
    type: "Essential",
    duration: "1 hour (auto-refreshed via refresh token up to 7 or 30 days depending on remember-me choice)",
    setBy: "Supabase (@supabase/ssr)",
  },
  {
    name: "sb-<ref>-auth-token-code-verifier",
    purpose: "PKCE code verifier for the OAuth sign-in flow (Google / GitHub). Deleted after use.",
    type: "Essential",
    duration: "Session (deleted immediately after OAuth callback)",
    setBy: "Supabase (@supabase/ssr)",
  },
  {
    name: "sb_rm",
    purpose: "Remembers whether you selected \"Stay signed in for 30 days\". Controls session expiry and the cross-tab sign-out behaviour.",
    type: "Preference",
    duration: "7 days (remember-me off) or 30 days (remember-me on)",
    setBy: "Jobnest (/auth/callback, server action)",
  },
];

const LOCAL_STORAGE_ENTRIES = [
  {
    name: "jobnest_cookie_consent",
    purpose: "Stores your cookie consent choice (\"all\" or \"essential\"). Prevents the banner from showing again.",
    duration: "Persistent (until manually cleared)",
    setBy: "Jobnest (CookieBanner component)",
  },
];

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">

          {/* Header */}
          <div className="mb-12">
            <Link href="/" className="landing-nav-link text-sm font-medium mb-8 inline-block hover:text-[#99462a] transition-colors">
              ← Back to Jobnest
            </Link>
            <h1 className="landing-serif text-4xl sm:text-5xl font-medium text-[#1a1c1b] mt-6 mb-3">
              Cookie Policy
            </h1>
            <p className="text-[#55433d] text-sm">Last updated: 29 March 2026</p>
            <div className="mt-4 p-4 bg-[#f4f3f1] rounded-xl border border-[#dbc1b9]/30 text-sm text-[#55433d] leading-relaxed">
              <strong className="text-[#1a1c1b]">Short version:</strong> Jobnest only uses cookies that are
              strictly necessary to run the service. We set <strong className="text-[#1a1c1b]">zero</strong>{" "}
              tracking, advertising, or analytics cookies. You cannot opt out of essential cookies without
              losing the ability to sign in.
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8 text-[#55433d] leading-relaxed">

            <Section title="1. What Are Cookies?">
              <p>
                Cookies are small text files placed on your device by a website. They help the website
                remember information about your visit — for example, keeping you signed in between page
                loads. Jobnest uses HTTP cookies (sent in request headers) and <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">localStorage</code> (client-side
                only) for different purposes explained below.
              </p>
            </Section>

            <Section title="2. Cookies We Set">
              <p className="mb-4">
                The following table lists every cookie set by Jobnest or its authentication provider
                (Supabase). The <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">&lt;ref&gt;</code> placeholder in cookie names is a short identifier for
                your Supabase project — it looks like a random alphanumeric string.
              </p>
              <CookieTable rows={SESSION_COOKIES} />
            </Section>

            <Section title="3. localStorage We Use">
              <p className="mb-4">
                In addition to cookies, we use <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">localStorage</code> for one entry. Unlike cookies,
                localStorage values are never sent to our servers — they exist only in your browser.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#f4f3f1]">
                      <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Key</th>
                      <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Purpose</th>
                      <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Duration</th>
                      <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Set by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LOCAL_STORAGE_ENTRIES.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2.5 border border-[#dbc1b9]/30 align-top">
                          <code className="font-mono text-xs bg-[#f4f3f1] px-1.5 py-0.5 rounded">{row.name}</code>
                        </td>
                        <td className="p-2.5 border border-[#dbc1b9]/30 align-top text-[#55433d]">{row.purpose}</td>
                        <td className="p-2.5 border border-[#dbc1b9]/30 align-top text-[#55433d]">{row.duration}</td>
                        <td className="p-2.5 border border-[#dbc1b9]/30 align-top text-[#55433d]">{row.setBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="4. Cookies We Do NOT Set">
              <p className="mb-3">Jobnest does <strong>not</strong> set any of the following:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li><strong className="text-[#1a1c1b]">Analytics cookies</strong> (e.g., Google Analytics, Mixpanel, Amplitude)</li>
                <li><strong className="text-[#1a1c1b]">Advertising / tracking cookies</strong> (e.g., Meta Pixel, Google Ads, LinkedIn Insight Tag)</li>
                <li><strong className="text-[#1a1c1b]">Third-party social cookies</strong> (e.g., Facebook Like button, Twitter widgets)</li>
                <li><strong className="text-[#1a1c1b]">Cross-site tracking identifiers</strong> of any kind</li>
              </ul>
              <p className="mt-4">
                If this ever changes — for example, if we add an analytics product — we will update this
                policy, add the cookies to the table above, and ask for your explicit consent before setting them.
              </p>
            </Section>

            <Section title="5. Cookie Types Explained">
              <dl className="space-y-4">
                <div>
                  <dt className="font-semibold text-[#1a1c1b]">
                    <span className="inline-flex rounded-full bg-[#99462a]/10 text-[#99462a] px-2 py-0.5 text-xs font-medium mr-2">Essential</span>
                    Essential / Strictly Necessary
                  </dt>
                  <dd className="mt-1 text-sm">
                    Required for the website to function. Without them you cannot sign in or stay signed in.
                    These are set based on your contract with us to provide the service (GDPR Art. 6(1)(b))
                    and cannot be disabled without losing access to Jobnest.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#1a1c1b]">
                    <span className="inline-flex rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium mr-2">Preference</span>
                    Preference / Functionality
                  </dt>
                  <dd className="mt-1 text-sm">
                    Remember choices you make to improve your experience (e.g., remember-me duration).
                    These can be declined by choosing &ldquo;Essential only&rdquo; in the cookie banner,
                    though this may reduce convenience (you will be signed out more frequently).
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#1a1c1b]">
                    <span className="inline-flex rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium mr-2">Analytics</span>
                    Analytics / Performance
                  </dt>
                  <dd className="mt-1 text-sm">
                    Not currently used. We collect no analytics cookies. This category is listed for completeness.
                  </dd>
                </div>
              </dl>
            </Section>

            <Section title="6. Managing & Deleting Cookies">
              <p className="mb-3">
                You have several options to control cookies:
              </p>
              <ul className="space-y-3 pl-5 list-disc">
                <li>
                  <strong className="text-[#1a1c1b]">Cookie banner:</strong> Choose &ldquo;Essential only&rdquo;
                  or &ldquo;Accept all&rdquo; via the banner at the bottom of the page on first visit.
                  Change your preference at any time by clearing the{" "}
                  <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">jobnest_cookie_consent</code>{" "}
                  key from your browser&apos;s localStorage (DevTools → Application → Local Storage).
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Browser settings:</strong> Most browsers let you block
                  or delete cookies. Note that blocking essential cookies will break sign-in functionality.
                  Instructions for common browsers:{" "}
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline">Chrome</a>,{" "}
                  <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline">Firefox</a>,{" "}
                  <a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline">Safari</a>.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Sign out:</strong> Signing out removes your session
                  cookies immediately.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Account deletion:</strong> Deleting your Jobnest account
                  triggers full data removal including session cookies.
                </li>
              </ul>
            </Section>

            <Section title="7. Third-Party Cookies">
              <p>
                Jobnest loads fonts from Google Fonts via the <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">fonts.googleapis.com</code> and{" "}
                <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">fonts.gstatic.com</code> domains.
                Google may set its own cookies when these requests are made. We use{" "}
                <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">display:swap</code> and{" "}
                <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">rel=preconnect</code> to
                minimise font requests; we do not include any Google Analytics script. Consult{" "}
                <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline">
                  Google&apos;s Cookie Policy
                </a>{" "}
                for details on font-related cookies. No other third-party domains set cookies on Jobnest pages.
              </p>
            </Section>

            <Section title="8. Changes to This Policy">
              <p>
                We will update this Cookie Policy when new cookies are added or existing cookies change.
                The &ldquo;Last updated&rdquo; date at the top of the page will reflect the most recent
                revision. If we add any non-essential cookies, we will re-show the consent banner.
              </p>
            </Section>

            <Section title="9. Contact">
              <p>
                Questions about our use of cookies? Please use our{" "}
                <Link href="/contact" className="text-[#99462a] hover:underline font-medium">contact page</Link>.
                See also our{" "}
                <Link href="/privacy" className="text-[#99462a] hover:underline font-medium">Privacy Policy</Link>{" "}
                for the full picture of how we handle your personal data.
              </p>
            </Section>

          </div>
    </div>
  );
}
