import { publicPath } from "@/lib/mount";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* next/image does not add basePath; this file is served under /login. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicPath("/brand/pioneer-p-mark.png")}
            alt="Pioneer Digital AI"
            width={55}
            height={40}
            className="h-10 w-auto"
          />
          <p className="text-center text-sm font-semibold tracking-tight">Pioneer OS</p>
        </div>
        {children}
      </div>
    </main>
  );
}
