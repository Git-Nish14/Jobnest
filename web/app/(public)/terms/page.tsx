import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the terms and conditions for using Jobnest's job application tracking service.",
  openGraph: {
    title: "Terms of Use | Jobnest",
    description: "Read the terms and conditions for using Jobnest's job application tracking service.",
    url: "/terms",
  },
  twitter: {
    card: "summary",
    title: "Terms of Use | Jobnest",
    description: "Read the terms and conditions for using Jobnest's job application tracking service.",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#dbc1b9]/20 pb-8 last:border-0">
      <h2 className="landing-serif text-xl sm:text-2xl font-semibold text-[#1a1c1b] mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">

          {/* Header */}
          <div className="mb-12">
            <Link href="/" className="landing-nav-link text-sm font-medium mb-8 inline-block hover:text-[#99462a] transition-colors">
              ← Back to Jobnest
            </Link>
            <h1 className="landing-serif text-4xl sm:text-5xl font-medium text-[#1a1c1b] mt-6 mb-3">
              Terms of Use
            </h1>
            <p className="text-[#55433d] text-sm">Last updated: 19 May 2026</p>
          </div>

          <div className="space-y-8 text-[#55433d] leading-relaxed">
            <Section title="1. Acceptance of Terms">
              <p>
                By creating an account or using Jobnest — including via Google or GitHub OAuth — you confirm that
                you have read, understood, and agree to be bound by these Terms of Use and our{" "}
                <Link href="/privacy" className="text-[#99462a] hover:underline font-medium">Privacy Policy</Link>.
                If you do not agree to these terms, please do not use our service.
              </p>
            </Section>

            <Section title="2. Age Requirement">
              <p className="mb-3">
                <strong>You must be at least 18 years of age to create an account or use Jobnest.</strong> By
                registering, you represent and warrant that you are 18 years of age or older. This requirement
                applies to:
              </p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Email and password registration</li>
                <li>Sign-up or sign-in via Google OAuth</li>
                <li>Sign-up or sign-in via GitHub OAuth</li>
              </ul>
              <p className="mt-3">
                If we learn that an account has been created by a person under the age of 18, we reserve the right
                to suspend or permanently delete that account and all associated data without notice.
              </p>
            </Section>

            <Section title="3. Description of Service">
              <p className="mb-3">
                Jobnest is a web application developed by{" "}
                <a href="https://nishpatel.dev" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  Nish Patel
                </a>{" "}
                that provides an all-in-one career workspace for job seekers. The service includes:
              </p>
              <ul className="space-y-1.5 pl-5 list-disc text-sm">
                <li><strong className="text-[#1a1c1b]">Application tracking</strong> — list and kanban views, status timeline, bulk actions, and ATS completeness scoring</li>
                <li><strong className="text-[#1a1c1b]">Document Sanctuary</strong> — versioned document library with PDF annotations, secure sharing links, Google Drive / Dropbox import, and ATS keyword scanning</li>
                <li><strong className="text-[#1a1c1b]">NESTAi AI assistant</strong> — powered by Groq / Llama; interview prep mode, email drafting, JD parsing, and file-aware responses</li>
                <li><strong className="text-[#1a1c1b]">Interview Prep Hub</strong> — LeetCode problem tracker, system design checklist, STAR behavioral bank, mock interview scheduler, and daily streak</li>
                <li><strong className="text-[#1a1c1b]">Developer Portfolio</strong> — GitHub integration, project showcase, skills/education/certifications, and a public shareable <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">/p/username</code> page</li>
                <li><strong className="text-[#1a1c1b]">Total Compensation Calculator</strong> — RSU vesting, 401(k) match, cost-of-living normalisation, state tax estimation, and offer comparison PDF export</li>
                <li><strong className="text-[#1a1c1b]">Analytics</strong> — application velocity, stage funnel, source effectiveness, and salary benchmarking from your own data</li>
                <li><strong className="text-[#1a1c1b]">Reminders & contacts</strong> — follow-up automation, interview scheduling, and a contact CRM</li>
              </ul>
              <p className="mt-3">
                A <strong className="text-[#1a1c1b]">Free plan</strong> and a paid{" "}
                <strong className="text-[#1a1c1b]">Pro plan</strong> are available. Pro plan billing is
                processed by Stripe. See our{" "}
                <a href="/pricing" className="text-[#99462a] hover:underline font-medium">Pricing page</a> for
                current plan details and pricing.
              </p>
            </Section>

            <Section title="4. User Accounts">
              <p className="mb-3">To use Jobnest, you must create an account and be at least 18 years of age. You agree to:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Provide accurate and complete information when creating your account</li>
                <li>Confirm that you meet the minimum age requirement of 18 years</li>
                <li>Maintain the security of your password and account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>
            </Section>

            <Section title="5. Acceptable Use">
              <p className="mb-3">You agree not to use Jobnest to:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Upload malicious content, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for any illegal or fraudulent purpose</li>
                <li>Share your account credentials with others</li>
                <li>Use the service for commercial resale or redistribution of data</li>
              </ul>
            </Section>

            <Section title="6. User Content">
              <p className="mb-4">
                You retain ownership of all content you upload to Jobnest, including job application data and documents.
                By uploading content, you grant us a limited license to store and display your content solely for the purpose
                of providing the service to you.
              </p>
              <p>
                You are responsible for ensuring that your content does not violate any third-party rights or applicable laws.
              </p>
            </Section>

            <Section title="7. AI Features (NESTAi &amp; ATS Scanner)">
              <p className="mb-3">
                Jobnest includes an AI-powered assistant (&quot;NESTAi&quot;) powered by Groq (Llama models) and an
                ATS Scanner supporting multiple providers (Groq, OpenAI, Anthropic Claude, Google Gemini,
                Perplexity). AI-generated responses are provided for <strong>informational purposes only</strong> and
                do not constitute professional career, legal, or financial advice.
              </p>
              <p>
                You are responsible for independently verifying any AI-generated content before acting on it.
                Documents you upload (resumes, cover letters, job descriptions) are processed server-side and
                may be transmitted to third-party AI providers solely to generate your requested response. These
                providers are contractually prohibited from using your content to train their models. See Section 5
                of our{" "}
                <a href="/privacy" className="text-[#99462a] hover:underline font-medium">Privacy Policy</a>{" "}
                for the full sub-processor list.
              </p>
            </Section>

            <Section title="7a. Developer Portfolio &amp; Public Profile">
              <p className="mb-3">
                Jobnest allows you to claim a unique username and publish a public portfolio page at{" "}
                <code className="text-xs font-mono bg-[#f4f3f1] px-1 py-0.5 rounded">jobnest.app/p/&lt;username&gt;</code>.
                By enabling the public portfolio you agree that:
              </p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>The information you choose to display (name, bio, projects, skills, education, pinned GitHub repos) will be publicly accessible without authentication.</li>
                <li>Your email address is <strong>not</strong> disclosed on your public profile unless you explicitly enable the &quot;Show email&quot; option.</li>
                <li>Your job application data (companies applied to, statuses, salaries, notes) is <strong>never</strong> exposed on your public profile page.</li>
                <li>Usernames may only be changed once every 30 days. We reserve the right to reclaim usernames that violate these Terms.</li>
              </ul>
            </Section>

            <Section title="7b. Billing &amp; Pro Plan">
              <p>
                Pro plan subscriptions are billed monthly or annually through <strong>Stripe</strong>. By
                subscribing you agree to Stripe&apos;s{" "}
                <a href="https://stripe.com/ssa" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  Services Agreement
                </a>.
                Jobnest does not store or process your payment card details — all payment data is handled
                directly by Stripe. Subscriptions auto-renew until cancelled. You may cancel at any time
                via the billing portal; your Pro access continues until the end of the paid period.
              </p>
            </Section>

            <Section title="8. Service Availability">
              <p>
                While we strive to maintain high availability, we do not guarantee uninterrupted access to Jobnest.
                We may modify, suspend, or discontinue the service at any time with or without notice. We are not liable
                for any interruption or loss of service.
              </p>
            </Section>

            <Section title="9. Disclaimer of Warranties">
              <p>
                Jobnest is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied.
                We do not warrant that the service will be error-free, secure, or available at all times.
              </p>
            </Section>

            <Section title="10. Limitation of Liability">
              <p>
                To the maximum extent permitted by law, Jobnest and its creators (Nish Patel) shall not be liable for
                any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits,
                or business opportunities, arising from your use of the service.
              </p>
            </Section>

            <Section title="11. Account Termination">
              <p>
                You may delete your account at any time via your profile page. Deletion follows a 30-day grace period
                during which your account remains accessible and the deletion can be cancelled. After 30 days, your
                account and all associated data are permanently deleted. We reserve the right to suspend or terminate
                accounts that violate these terms, engage in abusive behaviour, or are found to belong to users under
                the age of 18. Upon termination, your data will be deleted in accordance with our Privacy Policy.
              </p>
            </Section>

            <Section title="12. Changes to Terms">
              <p>
                We may update these Terms of Use from time to time. We will notify you of significant changes by posting
                a notice on our website. Your continued use of the service after changes are posted constitutes acceptance
                of the modified terms.
              </p>
            </Section>

            <Section title="13. Governing Law">
              <p>
                These Terms of Use shall be governed by and construed in accordance with applicable laws, without regard
                to conflict of law principles.
              </p>
            </Section>

            <Section title="14. Contact">
              <p>
                If you have any questions about these Terms of Use, please{" "}
                <Link href="/contact" className="text-[#99462a] hover:underline font-medium">
                  contact us
                </Link>
                {" "}or visit us on{" "}
                <a href="https://github.com/Git-Nish14/Jobnest" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  GitHub
                </a>
                .
              </p>
            </Section>
          </div>
    </div>
  );
}
