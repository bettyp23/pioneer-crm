import Link from "next/link";

import { Button } from "@/components/ui/button";

// Also rendered when a user lacks permission for a page (requirePagePermission),
// so it never reveals whether the page exists.
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
