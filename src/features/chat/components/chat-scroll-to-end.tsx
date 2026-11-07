"use client";

import { useEffect } from "react";

// Keep the newest message in view, like a messaging app: on first load and whenever a new
// message arrives.
export function ChatScrollToEnd({ count }: { count: number }) {
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight });
  }, [count]);
  return null;
}
