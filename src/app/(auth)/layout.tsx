export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-semibold tracking-tight">Pioneer OS</p>
        {children}
      </div>
    </main>
  );
}
