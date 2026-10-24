"use client";

import { useTransition, type ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

// A button that runs a Server Action and reports the result as a toast.
export function ActionButton({
  action,
  successMessage,
  confirmMessage,
  children,
  ...props
}: {
  action: () => Promise<ActionResult>;
  successMessage?: string;
  confirmMessage?: string;
} & Omit<ComponentProps<typeof Button>, "onClick">) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        startTransition(async () => {
          const result = await action();
          if (result.ok) {
            if (successMessage) toast.success(successMessage);
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      {children}
    </Button>
  );
}
