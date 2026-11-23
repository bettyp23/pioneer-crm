"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { publicPath } from "@/lib/mount";

// Live updates: the server pushes a "change" event (Server-Sent Events) when a message or a
// delivery status in this thread changes, and the page re-renders. EventSource reconnects by
// itself; the server closes each stream after a few minutes.
export function ChatLive({ threadId }: { threadId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!threadId) return;
    const source = new EventSource(
      publicPath(`/api/chat/events?thread=${encodeURIComponent(threadId)}`),
    );
    source.addEventListener("change", () => router.refresh());
    // Catch anything that arrived between rendering and (re)connecting.
    source.addEventListener("open", () => router.refresh());
    return () => source.close();
  }, [threadId, router]);
  return null;
}
