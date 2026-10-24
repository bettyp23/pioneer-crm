"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Connection } from "@/features/chat/schemas";
import { resumeConnection } from "@/features/chat/server/actions";

export function ResumeConnectionButton({ connection }: { connection: Connection }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resumeConnection({ connection });
          if (result.ok) toast.success("Connection resumed");
          else toast.error(result.error);
        })
      }
    >
      Resume
    </Button>
  );
}
