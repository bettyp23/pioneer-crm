import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Native <select> styled like shadcn inputs: accessible, keyboard- and mobile-friendly,
// and works with react-hook-form's register().
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs",
        "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
