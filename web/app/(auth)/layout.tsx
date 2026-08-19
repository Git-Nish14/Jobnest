import { ThemeToggle } from "@/components/layout/ThemeToggle";
import "./auth.css";

// Fonts (--font-newsreader, --font-manrope) are declared in root layout.tsx
// and cascade down — no duplicate font loading needed here.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-black font-(family-name:--font-manrope) relative">
      {/* Theme toggle — fixed top-right, visible on all auth pages */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <main id="main-content">
        {children}
      </main>
    </div>
  );
}
