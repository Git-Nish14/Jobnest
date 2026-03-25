"use client";

/** Scrolls to a section by id without adding a hash to the URL.
 *  This prevents the browser from restoring the hash on back-navigation
 *  from /login or /signup, which caused the page to auto-scroll on return. */
export function LandingScrollLink({
  sectionId,
  className,
  children,
}: {
  sectionId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" })
      }
    >
      {children}
    </button>
  );
}

export function LandingScrollToTop({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      {children}
    </button>
  );
}
