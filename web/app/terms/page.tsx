import Link from "next/link";
import type { Metadata } from "next";
import { Newsreader, Manrope } from "next/font/google";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import "../landing.css";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the terms and conditions for using Jobnest's job application tracking service.",
};

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"], weight: ["400", "500", "600", "700"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

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
    <LayoutWrapper footerVariant="simple">
      <div className={`${newsreader.variable} ${manrope.variable} landing-root`}>
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">

          {/* Header */}
          <div className="mb-12">
            <Link href="/" className="landing-nav-link text-sm font-medium mb-8 inline-block hover:text-[#99462a] transition-colors">
              ← Back to Jobnest
            </Link>
            <h1 className="landing-serif text-4xl sm:text-5xl font-medium text-[#1a1c1b] mt-6 mb-3">
              Terms of Use
            </h1>
            <p className="text-[#55433d] text-sm">Last updated: March 26, 2026</p>
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
              <p>
                Jobnest is a web application developed by{" "}
                <a href="https://techifive.com" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  Techifive
                </a>{" "}
                that allows users to track and manage their job applications. Our service includes features for
                logging applications, storing documents, AI-assisted job search (NESTAi), managing contacts and
                interview schedules, and monitoring job search progress. A free tier and optional paid Pro plan
                are available.
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

            <Section title="7. AI Features (NESTAi)">
              <p>
                Jobnest includes an AI-powered assistant (&quot;NESTAi&quot;) powered by third-party AI services (Groq / Llama).
                AI-generated responses are provided for informational purposes only and do not constitute professional
                career, legal, or financial advice. You are responsible for independently verifying any AI-generated
                content before acting on it. Uploaded documents (resumes, cover letters) are processed server-side
                and may be transmitted to third-party AI providers solely to generate responses.
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
                To the maximum extent permitted by law, Jobnest and its creators (Techifive) shall not be liable for
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
                <a href="https://github.com/techifive" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  GitHub
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}
