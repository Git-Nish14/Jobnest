import Link from "next/link";
import type { Metadata } from "next";
import { Newsreader, Manrope } from "next/font/google";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import "../landing.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Jobnest collects, uses, and protects your personal information.",
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

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-[#55433d] text-sm">Last updated: March 16, 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-[#55433d] leading-relaxed">
            <Section title="1. Introduction">
              <p>
                Welcome to Jobnest, a product of{" "}
                <a href="https://nishpatel.dev" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  Nish Patel
                </a>
                . We are committed to protecting your personal information and your right to privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
                job application tracking service.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p className="mb-3">We collect information that you provide directly to us, including:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li><strong className="text-[#1a1c1b]">Account Information:</strong> Email address and password when you create an account.</li>
                <li><strong className="text-[#1a1c1b]">Job Application Data:</strong> Company names, job titles, application statuses, salary information, notes, and dates you choose to track.</li>
                <li><strong className="text-[#1a1c1b]">Documents:</strong> Resumes, cover letters, and other documents you upload to the platform.</li>
                <li><strong className="text-[#1a1c1b]">Usage Data:</strong> Information about how you interact with our service, including access times and pages viewed.</li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Information">
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
              </ul>
            </Section>

            <Section title="4. Data Storage and Security">
              <p className="mb-3">Your data is stored securely using Supabase, which provides enterprise-grade security including:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Encryption at rest and in transit</li>
                <li>Regular security audits and compliance certifications</li>
                <li>Row-level security ensuring you can only access your own data</li>
                <li>Automatic backups and disaster recovery</li>
              </ul>
            </Section>

            <Section title="5. Data Sharing">
              <p className="mb-3">
                We do not sell, trade, or otherwise transfer your personal information to third parties.
                Your job application data is private and only accessible by you. We may share information only in the following circumstances:
              </p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>With your consent or at your direction</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights, privacy, safety, or property</li>
              </ul>
            </Section>

            <Section title="6. Your Rights">
              <p className="mb-3">You have the right to:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify or update your personal information</li>
                <li>Delete your account and associated data</li>
                <li>Object to processing of your personal data</li>
                <li>Export your data in a portable format</li>
              </ul>
            </Section>

            <Section title="7. Cookies">
              <p className="mb-3">We use only essential cookies required for the service to function:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li><strong className="text-[#1a1c1b]">Authentication cookies:</strong> To maintain your login session securely</li>
                <li><strong className="text-[#1a1c1b]">Security cookies:</strong> For CSRF protection and rate limiting</li>
              </ul>
              <p className="mt-4">
                We do not use tracking cookies, analytics cookies, or share cookie data with third parties for advertising purposes.
              </p>
            </Section>

            <Section title="8. Email Communications">
              <p className="mb-3">We send emails only for essential purposes:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>OTP verification codes for login and signup</li>
                <li>Password reset confirmations</li>
                <li>Important security notifications</li>
                <li>Responses to your contact form submissions</li>
              </ul>
              <p className="mt-4">We do not send marketing emails or newsletters without explicit consent.</p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting
                the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </Section>

            <Section title="10. Contact Us">
              <p>
                If you have any questions about this Privacy Policy, please{" "}
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
      </div>
    </LayoutWrapper>
  );
}
