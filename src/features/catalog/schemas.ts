import { z } from "zod";

import { optionalMoney, optionalText, requiredText } from "@/lib/zod-helpers";

export const serviceFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9-]{2,40}$/,
      "Use 2–40 lowercase letters, numbers or dashes (e.g. website-build)",
    ),
  name: requiredText("a service name", 200),
  category: optionalText(80),
  description: optionalText(5000),
  list_price: optionalMoney,
  is_active: z.boolean(),
});
export type ServiceFormInput = z.input<typeof serviceFormSchema>;

export const packageFormSchema = z.object({
  name: requiredText("a package name", 200),
  description: optionalText(5000),
  list_price: optionalMoney,
  is_active: z.boolean(),
});
export type PackageFormInput = z.input<typeof packageFormSchema>;

export const packageLineSchema = z.object({
  package_id: z.uuid(),
  service_id: z.uuid("Choose a service"),
  quantity: z.coerce.number().int().min(1, "At least 1").max(1000),
});

export const catalogTabs = [
  { key: "services", label: "Services", href: "/catalog/services" },
  { key: "packages", label: "Packages", href: "/catalog/packages" },
];
