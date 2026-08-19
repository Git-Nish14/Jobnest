// Fonts (--font-newsreader, --font-manrope) cascade from root layout.tsx.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-black"
      style={{ fontFamily: "var(--font-manrope, system-ui), sans-serif" }}
    >
      {children}
    </div>
  );
}
