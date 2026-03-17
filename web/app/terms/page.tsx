import Link from "next/link";
import type { Metadata } from "next";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the terms and conditions for using Jobnest's job application tracking service.",
};

export default function TermsPage() {
  return (
    <LayoutWrapper footerVariant="simple">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: March 16, 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">1. Acceptance of Terms</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              By accessing and using Jobnest, you accept and agree to be bound by these Terms of Use.
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">2. Description of Service</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Jobnest is a free web application developed by{" "}
              <a href="https://techifive.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Techifive
              </a>{" "}
              that allows users to track and manage their job applications.
              Our service includes features for logging applications, storing documents, and monitoring job search progress.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">3. User Accounts</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              To use Jobnest, you must create an account. You agree to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Provide accurate and complete information when creating your account</li>
              <li>Maintain the security of your password and account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">4. Acceptable Use</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              You agree not to use Jobnest to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Upload malicious content, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use the service for any illegal or fraudulent purpose</li>
              <li>Share your account credentials with others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">5. User Content</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              You retain ownership of all content you upload to Jobnest, including job application data and documents.
              By uploading content, you grant us a limited license to store and display your content solely for the purpose
              of providing the service to you.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              You are responsible for ensuring that your content does not violate any third-party rights or applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">6. Service Availability</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              While we strive to maintain high availability, we do not guarantee uninterrupted access to Jobnest.
              We may modify, suspend, or discontinue the service at any time with or without notice. We are not liable
              for any interruption or loss of service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">7. Disclaimer of Warranties</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Jobnest is provided "as is" and "as available" without warranties of any kind, either express or implied.
              We do not warrant that the service will be error-free, secure, or available at all times.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">8. Limitation of Liability</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Jobnest and its creators (Techifive) shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including loss of data, profits, or business opportunities,
              arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">9. Account Termination</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate
              these terms or engage in abusive behavior. Upon termination, your data will be deleted in accordance with our
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">10. Changes to Terms</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We may update these Terms of Use from time to time. We will notify you of significant changes by posting
              a notice on our website. Your continued use of the service after changes are posted constitutes acceptance
              of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">11. Governing Law</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              These Terms of Use shall be governed by and construed in accordance with applicable laws, without regard
              to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold sm:text-2xl">12. Contact</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Use, please contact us at:{" "}
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
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Jobnest is a product of{" "}
              <a href="https://techifive.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Techifive
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </LayoutWrapper>
  );
}
