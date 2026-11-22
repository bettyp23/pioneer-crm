"use client";

import { useRef, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

// A plain <form> that sends its fields to a Server Action and reports the result as a toast.
// Inputs are disabled while the action runs; the form is cleared after a success.
export function ActionForm({
  action,
  successMessage,
  resetOnSuccess = true,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  successMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        // The submit button that was pressed (e.g. Yes / No) travels with the form data.
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        if (submitter instanceof HTMLButtonElement && submitter.name) {
          formData.set(submitter.name, submitter.value);
        }
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            if (successMessage) toast.success(successMessage);
            if (resetOnSuccess) formRef.current?.reset();
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
