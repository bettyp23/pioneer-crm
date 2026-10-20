import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs",
        "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
