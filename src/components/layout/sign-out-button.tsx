import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

// Plain form POST so it works without client JavaScript. Same-origin form posts are
// allowed by CSP form-action 'self'; the route handler checks Origin.
export function SignOutButton({
  label = "Sign out",
  formClassName,
  ...props
}: { label?: string; formClassName?: string } & Omit<ComponentProps<typeof Button>, "type">) {
  return (
    <form action="/auth/sign-out" method="post" className={formClassName}>
      <Button type="submit" {...props}>
        {label}
      </Button>
    </form>
  );
}
