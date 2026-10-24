"use client";

import { Button } from "@/components/ui/button";

// Generic error boundary: never shows error messages or stack traces to the user.
// `digest` (server errors) lets the owner correlate with server logs.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        The error has been logged.
        {digest ? (
          <>
            {" "}
            Reference: <code className="font-mono">{digest}</code>
          </>
        ) : null}
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
