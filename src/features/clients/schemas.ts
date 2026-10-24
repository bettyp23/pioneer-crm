import { z } from "zod";

import { optionalDriveUrl, optionalHttpsUrl, optionalText, requiredText } from "@/lib/zod-helpers";

export const CLIENT_STATUSES = ["prospect", "active", "paused", "former"] as const;
export const CLIENT_KINDS = ["organization", "individual"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  paused: "Paused",
  former: "Former",
};

export const clientFormSchema = z.object({
  name: requiredText("a client name", 200),
  legal_name: optionalText(200),
  kind: z.enum(CLIENT_KINDS),
  status: z.enum(CLIENT_STATUSES),
  industry: optionalText(120),
  website_url: optionalHttpsUrl(),
  drive_folder_url: optionalDriveUrl,
  notes: optionalText(10000),
});
export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormValues = z.output<typeof clientFormSchema>;

export const clientListParamsSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(CLIENT_STATUSES).optional().catch(undefined),
  archived: z
    .enum(["1"])
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
