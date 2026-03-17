export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-muted/40 px-3 sm:px-4 py-8 sm:py-12">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />
      <div className="absolute left-1/2 top-0 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/6 blur-[100px]" />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
