import Link from "next/link";
import type { Metadata } from "next";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Jobnest collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LayoutWrapper footerVariant="simple">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: March 16, 2026</p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">1. Introduction</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Welcome to Jobnest, a product of{" "}
              <a href="https://techifive.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Techifive
              </a>
              . We are committed to protecting your personal information and your right to privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
              job application tracking service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">2. Information We Collect</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li><strong>Account Information:</strong> Email address and password when you create an account.</li>
              <li><strong>Job Application Data:</strong> Company names, job titles, application statuses, salary information, notes, and dates you choose to track.</li>
              <li><strong>Documents:</strong> Resumes, cover letters, and other documents you upload to the platform.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our service, including access times and pages viewed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">3. How We Use Your Information</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Provide, maintain, and improve our services</li>
              <li>Process and complete transactions</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">4. Data Storage and Security</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Your data is stored securely using Supabase, which provides enterprise-grade security including:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Encryption at rest and in transit</li>
              <li>Regular security audits and compliance certifications</li>
              <li>Row-level security ensuring you can only access your own data</li>
              <li>Automatic backups and disaster recovery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">5. Data Sharing</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We do not sell, trade, or otherwise transfer your personal information to third parties.
              Your job application data is private and only accessible by you. We may share information only in the following circumstances:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>With your consent or at your direction</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights, privacy, safety, or property</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">6. Your Rights</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Access and receive a copy of your personal data</li>
              <li>Rectify or update your personal information</li>
              <li>Delete your account and associated data</li>
              <li>Object to processing of your personal data</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">7. Cookies</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We use only essential cookies required for the service to function:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li><strong>Authentication cookies:</strong> To maintain your login session securely</li>
              <li><strong>Security cookies:</strong> For CSRF protection and rate limiting</li>
            </ul>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We do not use tracking cookies, analytics cookies, or share cookie data with third parties for advertising purposes.
              All our cookies are strictly necessary for the operation of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">8. Email Communications</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We send emails only for essential purposes:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>OTP verification codes for login and signup</li>
              <li>Password reset confirmations</li>
              <li>Important security notifications</li>
              <li>Responses to your contact form submissions</li>
            </ul>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We do not send marketing emails or newsletters without explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">9. Changes to This Policy</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting
              the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">10. Contact Us</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:{" "}
              <Link href="/contact" className="text-primary hover:underline">
                our contact page
              </Link>
              {" "}or visit us on{" "}
              <a
                href="https://github.com/techifive"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </LayoutWrapper>
  );
}
