import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Jobnest collects, uses, stores, and protects your personal information. GDPR / CCPA compliant.",
};

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-b border-[#dbc1b9]/20 pb-8 last:border-0">
      <h2 className="landing-serif text-xl sm:text-2xl font-semibold text-[#1a1c1b] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function DataTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse mt-3">
        <thead>
          <tr className="bg-[#f4f3f1]">
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Category</th>
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Data</th>
            <th className="text-left p-2.5 border border-[#dbc1b9]/30 font-semibold text-[#1a1c1b]">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([cat, data, purpose], i) => (
            <tr key={i} className={i % 2 === 0 ? "" : "bg-[#f4f3f1]/50"}>
              <td className="p-2.5 border border-[#dbc1b9]/30 font-medium text-[#1a1c1b] align-top whitespace-nowrap">{cat}</td>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top">{data}</td>
              <td className="p-2.5 border border-[#dbc1b9]/30 align-top">{purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">

          {/* Header */}
          <div className="mb-12">
            <Link href="/" className="landing-nav-link text-sm font-medium mb-8 inline-block hover:text-[#99462a] transition-colors">
              ← Back to Jobnest
            </Link>
            <h1 className="landing-serif text-4xl sm:text-5xl font-medium text-[#1a1c1b] mt-6 mb-3">
              Privacy Policy
            </h1>
            <p className="text-[#55433d] text-sm">Last updated: 29 March 2026</p>
            <div className="mt-4 p-4 bg-[#f4f3f1] rounded-xl border border-[#dbc1b9]/30 text-sm text-[#55433d] leading-relaxed">
              <strong className="text-[#1a1c1b]">Quick summary:</strong> We collect only what we need to run
              the service. We do not sell your data. You can export or delete everything at any time. We use
              Supabase (EU-hosted by default) for storage.
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8 text-[#55433d] leading-relaxed">

            <Section title="1. Who We Are">
              <p>
                Jobnest (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a job-application tracking
                service operated by{" "}
                <a href="https://nishpatel.dev" target="_blank" rel="noopener noreferrer"
                  className="text-[#99462a] hover:underline font-medium">
                  Nish Patel
                </a>{" "}
                (&ldquo;Controller&rdquo; under GDPR). Questions about this policy can be directed to our{" "}
                <Link href="/contact" className="text-[#99462a] hover:underline font-medium">contact page</Link>.
              </p>
            </Section>

            <Section title="2. Data We Collect">
              <p className="mb-4">
                We collect information in three ways: data you provide directly, data generated automatically
                as you use the service, and data from third-party sign-in providers (Google, GitHub).
              </p>
              <DataTable rows={[
                ["Account", "Email address, display name, hashed password or OAuth sub", "Authentication and account management"],
                ["Profile", "\"About Me\" context text, notification preferences", "Personalises NESTAi AI responses"],
                ["Job applications", "Company, position, status, dates, salary, location, notes, job URL", "Core service: tracking your job search"],
                ["Documents", "Resume and cover-letter files (PDF, DOCX, TXT, MD, PNG, JPEG)", "Stored in Supabase Storage scoped to your user ID"],
                ["Interviews & contacts", "Interview dates, types, notes; contact names and emails", "Core service features"],
                ["AI conversations", "Chat messages sent to NESTAi, file attachments", "Generating AI responses; persisted for chat history"],
                ["Security", "IP address on account-deletion requests and OTP events", "Fraud prevention and rate limiting"],
                ["Cookies", "Session token (sb-*-auth-token), remember-me flag (sb_rm)", "Keeping you signed in — see Cookie Policy"],
                ["Usage", "Pages visited, error events, approximate latency", "Service reliability and debugging only"],
              ]} />
              <p className="mt-4 text-sm italic">
                We do <strong className="not-italic font-semibold text-[#1a1c1b]">not</strong> collect precise
                location data, device fingerprints, browsing history outside Jobnest, or any special-category
                data (health, biometric, political, racial, etc.).
              </p>
            </Section>

            <Section title="3. Legal Basis for Processing (GDPR)">
              <p className="mb-3">
                For users in the EEA, UK, and Switzerland we rely on the following legal bases:
              </p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>
                  <strong className="text-[#1a1c1b]">Contract (Art. 6(1)(b)):</strong> Processing necessary
                  to provide the service you signed up for — authentication, storing your applications,
                  generating AI responses.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Legitimate interests (Art. 6(1)(f)):</strong> Security
                  monitoring, rate limiting, debugging, and service reliability.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Consent (Art. 6(1)(a)):</strong> Optional features such
                  as notification emails and the NESTAi &ldquo;About Me&rdquo; context. Withdrawable at any
                  time in Profile settings.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Legal obligation (Art. 6(1)(c)):</strong> Retaining
                  deletion records and IP logs where required by applicable law.
                </li>
              </ul>
            </Section>

            <Section title="4. How We Use Your Data">
              <ul className="space-y-2 pl-5 list-disc">
                <li>Provide and maintain the Jobnest service</li>
                <li>Authenticate you and keep your session secure</li>
                <li>Power NESTAi AI features using your job-search context</li>
                <li>Send transactional emails: OTP codes, password resets, account-deletion warnings</li>
                <li>Detect and prevent fraud, abuse, and unauthorised access</li>
                <li>Debug errors and improve service reliability</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p className="mt-4">
                We do <strong>not</strong> use your data for advertising, profiling for third-party purposes,
                or any automated decision-making that produces legal effects.
              </p>
            </Section>

            <Section title="5. Third-Party Services (Sub-processors)">
              <p className="mb-4">
                We share data with a small set of trusted processors only to the extent needed to run the service:
              </p>
              <DataTable rows={[
                ["Supabase", "Database, file storage, authentication", "EU region by default; SOC 2 Type II; DPA available"],
                ["Groq AI", "NESTAi AI inference (llama-3.3-70b)", "Messages sent for inference; not retained for model training"],
                ["Vercel", "Hosting, Edge network, serverless functions", "SOC 2 Type II; global CDN"],
                ["SMTP provider", "Transactional email delivery (OTP, password reset)", "Processes email addresses only"],
                ["Stripe (future)", "Payment processing for Pro plan", "PCI-DSS Level 1; Stripe processes card data directly"],
              ]} />
              <p className="mt-4 text-sm">
                We do not sell, rent, or trade your personal data with any third party. We do not use
                Google Analytics, Meta Pixel, or any other advertising or behavioural tracking service.
              </p>
            </Section>

            <Section title="6. Data Storage & Residency">
              <p className="mb-3">
                Your data is stored on Supabase infrastructure. Supabase projects are created in the region
                selected at project creation — typically{" "}
                <strong className="text-[#1a1c1b]">EU West (Ireland, eu-west-1)</strong>. Vercel serverless
                functions run globally but do not persist your data between requests.
              </p>
              <p>
                All data is encrypted{" "}
                <strong className="text-[#1a1c1b]">in transit</strong> (TLS 1.2+) and{" "}
                <strong className="text-[#1a1c1b]">at rest</strong> (AES-256). PostgreSQL Row-Level Security
                (RLS) policies ensure you can only read and write your own rows.
              </p>
            </Section>

            <Section title="7. Data Retention">
              <ul className="space-y-2 pl-5 list-disc">
                <li>
                  <strong className="text-[#1a1c1b]">Active accounts:</strong> Data is kept for as long as
                  your account is active.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Account deletion:</strong> When you request deletion,
                  your account enters a{" "}
                  <strong className="text-[#1a1c1b]">30-day grace period</strong>. You can reactivate during
                  this window. After 30 days, all personal data (applications, documents, interviews, contacts,
                  AI history, salary records) is permanently purged by an automated cron job.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Security logs:</strong> IP addresses recorded on deletion
                  requests and OTP events are retained for 90 days, then deleted.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Supabase backups:</strong> Automated point-in-time backups
                  are retained for 7 days (free plan) or 30 days (Pro). Backups are subject to the same
                  purge pipeline after restoration.
                </li>
              </ul>
            </Section>

            <Section title="8. Your Rights">
              <p className="mb-3">Under GDPR (EEA/UK) and similar laws you have the right to:</p>
              <ul className="space-y-3 pl-5 list-disc">
                <li>
                  <strong className="text-[#1a1c1b]">Access (Art. 15):</strong> Request a copy of all
                  personal data we hold about you.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Rectification (Art. 16):</strong> Correct inaccurate
                  data via your Profile page.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Erasure (Art. 17 — &ldquo;right to be forgotten&rdquo;):</strong>{" "}
                  Delete your account from Profile → Danger Zone. All data is purged after the 30-day grace
                  period.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Data portability (Art. 20):</strong> Export your
                  job-search data as CSV/JSON from the Applications page export button.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Restriction (Art. 18):</strong> Request that we limit
                  processing while a dispute is resolved.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Objection (Art. 21):</strong> Object to processing
                  based on legitimate interests.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Withdraw consent:</strong> Toggle optional features
                  off in Profile → Notifications at any time, without affecting prior lawful processing.
                </li>
              </ul>
              <p className="mt-4">
                To exercise any right, use our{" "}
                <Link href="/contact" className="text-[#99462a] hover:underline font-medium">contact page</Link>.
                We will respond within <strong className="text-[#1a1c1b]">30 days</strong> (GDPR Art. 12).
                If you believe we have breached data protection law, you have the right to lodge a complaint
                with your national supervisory authority (e.g., ICO in the UK, DPC in Ireland).
              </p>
            </Section>

            <Section title="9. Cookies & Local Storage">
              <p>
                We use only <strong className="text-[#1a1c1b]">essential</strong> cookies — no tracking,
                analytics, or advertising cookies. See our full{" "}
                <Link href="/cookies" className="text-[#99462a] hover:underline font-medium">Cookie Policy</Link>{" "}
                for a cookie-by-cookie breakdown. Your cookie consent choice is stored in{" "}
                <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">localStorage</code> under
                the key{" "}
                <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">jobnest_cookie_consent</code>.
              </p>
            </Section>

            <Section title="10. Children">
              <p>
                Jobnest is not directed at anyone under 18 years of age. We do not knowingly collect personal
                data from minors. If we become aware that a minor has registered, we will delete their account
                immediately. See Section 2 of our{" "}
                <Link href="/terms" className="text-[#99462a] hover:underline font-medium">Terms of Use</Link>{" "}
                for the age requirement.
              </p>
            </Section>

            <Section title="11. Security Measures">
              <ul className="space-y-2 pl-5 list-disc">
                <li>TLS 1.2+ on all data in transit</li>
                <li>AES-256 encryption at rest via Supabase</li>
                <li>PostgreSQL Row-Level Security — per-user data isolation</li>
                <li>OTP-gated account deletion and password changes</li>
                <li>IP-level and per-email rate limiting on sensitive endpoints</li>
                <li>Dual-layer OTP rate limiting (10/min per IP, 3/min per email)</li>
                <li>Secure, HttpOnly session cookies with SameSite=Lax</li>
                <li>File-type validation (MIME + magic-byte check) on document uploads</li>
                <li>Content-Disposition: attachment forced on all document downloads (prevents stored XSS)</li>
              </ul>
              <p className="mt-4">
                No system is 100% secure. If you discover a security vulnerability, please report it
                responsibly via our{" "}
                <Link href="/contact" className="text-[#99462a] hover:underline font-medium">contact page</Link>{" "}
                before public disclosure.
              </p>
            </Section>

            <Section title="12. International Transfers">
              <p>
                Your data may be processed by Vercel&apos;s global edge network outside the EEA. Vercel
                provides Standard Contractual Clauses (SCCs) as a transfer mechanism. Supabase stores data
                in your selected region (EU by default). Groq AI processes inference requests in the US —
                only the message content you send is transferred and not stored long-term.
              </p>
            </Section>

            <Section title="13. California Privacy Rights (CCPA / CPRA)" id="do-not-sell">
              <p className="mb-3">California residents have the following rights:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>
                  <strong className="text-[#1a1c1b]">Right to know:</strong> The categories and specific
                  pieces of personal information we collect (see Section 2).
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Right to delete:</strong> Request deletion via Profile →
                  Danger Zone.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Right to correct:</strong> Update inaccurate information
                  via your Profile page.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Right to opt-out of sale:</strong> We do not sell
                  personal information. No opt-out mechanism is required, but you may{" "}
                  <Link href="/contact" className="text-[#99462a] hover:underline font-medium">contact us</Link>{" "}
                  to confirm.
                </li>
                <li>
                  <strong className="text-[#1a1c1b]">Right to non-discrimination:</strong> Exercising your
                  rights will not result in different or lesser service.
                </li>
              </ul>
            </Section>

            <Section title="14. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Material changes will be communicated
                by updating the &ldquo;Last updated&rdquo; date at the top of this page. For significant
                changes we will send an email notification to registered users at least{" "}
                <strong className="text-[#1a1c1b]">14 days</strong> in advance. Continued use after the
                effective date constitutes acceptance.
              </p>
            </Section>

            <Section title="15. Contact & Data Requests">
              <p>
                For privacy-related questions, data access requests, or complaints, please use our{" "}
                <Link href="/contact" className="text-[#99462a] hover:underline font-medium">contact page</Link>.
                We aim to respond within 30 days. For urgent security disclosures, please include
                &ldquo;Security&rdquo; in your message subject.
              </p>
            </Section>

          </div>
    </div>
  );
}
