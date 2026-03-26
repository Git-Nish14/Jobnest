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
            <p className="text-[#55433d] text-sm">Last updated: March 16, 2026</p>
          </div>

          <div className="space-y-8 text-[#55433d] leading-relaxed">
            <Section title="1. Acceptance of Terms">
              <p>
                By accessing and using Jobnest, you accept and agree to be bound by these Terms of Use.
                If you do not agree to these terms, please do not use our service.
              </p>
            </Section>

            <Section title="2. Description of Service">
              <p>
                Jobnest is a free web application developed by{" "}
                <a href="https://techifive.com" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                  Techifive
                </a>{" "}
                that allows users to track and manage their job applications.
                Our service includes features for logging applications, storing documents, and monitoring job search progress.
              </p>
            </Section>

            <Section title="3. User Accounts">
              <p className="mb-3">To use Jobnest, you must create an account. You agree to:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Provide accurate and complete information when creating your account</li>
                <li>Maintain the security of your password and account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>
            </Section>

            <Section title="4. Acceptable Use">
              <p className="mb-3">You agree not to use Jobnest to:</p>
              <ul className="space-y-2 pl-5 list-disc">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Upload malicious content, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for any illegal or fraudulent purpose</li>
                <li>Share your account credentials with others</li>
              </ul>
            </Section>

            <Section title="5. User Content">
              <p className="mb-4">
                You retain ownership of all content you upload to Jobnest, including job application data and documents.
                By uploading content, you grant us a limited license to store and display your content solely for the purpose
                of providing the service to you.
              </p>
              <p>
                You are responsible for ensuring that your content does not violate any third-party rights or applicable laws.
              </p>
            </Section>

            <Section title="6. Service Availability">
              <p>
                While we strive to maintain high availability, we do not guarantee uninterrupted access to Jobnest.
                We may modify, suspend, or discontinue the service at any time with or without notice. We are not liable
                for any interruption or loss of service.
              </p>
            </Section>

            <Section title="7. Disclaimer of Warranties">
              <p>
                Jobnest is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied.
                We do not warrant that the service will be error-free, secure, or available at all times.
              </p>
            </Section>

            <Section title="8. Limitation of Liability">
              <p>
                To the maximum extent permitted by law, Jobnest and its creators (Techifive) shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, including loss of data, profits, or business opportunities,
                arising from your use of the service.
              </p>
            </Section>

            <Section title="9. Account Termination">
              <p>
                You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate
                these terms or engage in abusive behavior. Upon termination, your data will be deleted in accordance with our
                Privacy Policy.
              </p>
            </Section>

            <Section title="10. Changes to Terms">
              <p>
                We may update these Terms of Use from time to time. We will notify you of significant changes by posting
                a notice on our website. Your continued use of the service after changes are posted constitutes acceptance
                of the modified terms.
              </p>
            </Section>

            <Section title="11. Governing Law">
              <p>
                These Terms of Use shall be governed by and construed in accordance with applicable laws, without regard
                to conflict of law principles.
              </p>
            </Section>

            <Section title="12. Contact">
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
