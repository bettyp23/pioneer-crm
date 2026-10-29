"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While a send is still open, re-render the page every few seconds so replies show up without
// a manual reload. Stops as soon as nothing is pending.
export function ChatAutoRefresh({
  active,
  intervalMs = 5000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
