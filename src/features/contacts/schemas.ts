import { z } from "zod";

import { optionalText, requiredText } from "@/lib/zod-helpers";

export const contactFormSchema = z.object({
  first_name: requiredText("a first name", 100),
  last_name: optionalText(100),
  email: z
    .string()
    .trim()
    .max(320)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  phone: optionalText(40),
  job_title: optionalText(120),
  is_primary: z.boolean(),
  notes: optionalText(10000),
});
export type ContactFormInput = z.input<typeof contactFormSchema>;

export function contactName(c: { first_name: string; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}
