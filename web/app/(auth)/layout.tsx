export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-3 sm:px-4 py-6 sm:py-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
