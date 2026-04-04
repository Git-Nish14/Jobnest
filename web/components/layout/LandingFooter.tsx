import Link from "next/link";
import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="border-t py-16 landing-footer">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">

        {/* Brand */}
        <div className="col-span-2">
          <div className="flex items-center gap-2.5 mb-5">
            <Image src="/new_logo_1.png" alt="Jobnest" width={32} height={32} className="h-8 w-8 logo-light" />
            <Image src="/dark_logo.png"  alt="Jobnest" width={32} height={32} className="h-8 w-8 logo-dark" />
            <span className="text-xl landing-logo-text">Jobnest</span>
          </div>
          <p className="text-sm leading-relaxed max-w-xs landing-footer-links">
            A digital sanctuary for career growth — where every application is
            managed, every opportunity tracked, and every step matters.
          </p>
          <p className="mt-3 text-xs landing-footer-links">
            A product of{" "}
            <a
              href="https://nishpatel.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-creator-link"
            >
              Nish Patel
            </a>
          </p>
        </div>

        {/* Product */}
        <div>
          <h4 className="font-bold text-sm mb-6 uppercase tracking-widest">
            Product
          </h4>
          <ul className="space-y-4 text-sm landing-footer-links">
            <li><Link href="/"               className="landing-footer-nav-link">Overview</Link></li>
            <li><Link href="/#features"      className="landing-footer-nav-link">Features</Link></li>
            <li><Link href="/#testimonials"  className="landing-footer-nav-link">Testimonials</Link></li>
            <li><Link href="/pricing"        className="landing-footer-nav-link">Pricing</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-bold text-sm mb-6 uppercase tracking-widest">
            Legal
          </h4>
          <ul className="space-y-4 text-sm">
            <li><Link href="/privacy"          className="landing-footer-nav-link">Privacy</Link></li>
            <li><Link href="/terms"            className="landing-footer-nav-link">Terms</Link></li>
            <li><Link href="/contact"          className="landing-footer-nav-link">Contact</Link></li>
            <li><Link href="/privacy#do-not-sell" className="landing-footer-nav-link">Do Not Sell My Info</Link></li>
            <li><Link href="/cookies"          className="landing-footer-nav-link">Cookie Policy</Link></li>
          </ul>
        </div>

        {/* Get Access */}
        <div className="col-span-2">
          <h4 className="font-bold text-sm mb-6 uppercase tracking-widest">
            Get Access
          </h4>
          <p className="text-xs mb-4 landing-footer-links">
            Build your career sanctuary today — free to start.
          </p>
          <Link
            href="/signup"
            className="inline-block px-6 py-2 rounded-lg text-sm font-bold transition-all landing-footer-signup"
          >
            Sign Up Free
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t flex flex-col md:flex-row justify-between gap-4 landing-footer-divider">
        <p className="text-xs landing-copyright">
          © {new Date().getFullYear()} Jobnest — a{" "}
          <a
            href="https://nishpatel.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-creator-link text-xs font-semibold"
          >
            Nish Patel
          </a>{" "}
          product. All rights reserved.
        </p>
        <div className="flex gap-6 text-xs">
          <Link href="/privacy" className="landing-footer-nav-link">Privacy</Link>
          <Link href="/terms"   className="landing-footer-nav-link">Terms</Link>
          <Link href="/contact" className="landing-footer-nav-link">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
