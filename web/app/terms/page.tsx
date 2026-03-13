import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the terms and conditions for using Jobnest's job application tracking service.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo_1.png"
              alt="Jobnest Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-lg font-bold">Jobnest</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: March 13, 2026</p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
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
                To the maximum extent permitted by law, Jobnest and its creators shall not be liable for any indirect,
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
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Image
                src="/logo_1.png"
                alt="Jobnest Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="font-semibold">Jobnest</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:gap-6">
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contact
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>
              <a
                href="https://techifive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                Techifive
              </a>
            </div>
          </div>
          <div className="mt-6 border-t pt-6 flex flex-col items-center justify-between gap-2 sm:mt-8 sm:pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground sm:text-sm">
              © {new Date().getFullYear()}{" "}
              <a
                href="https://techifive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-foreground transition-colors"
              >
                Techifive
              </a>
              . All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              A{" "}
              <a
                href="https://techifive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Techifive
              </a>
              {" "}Product
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
