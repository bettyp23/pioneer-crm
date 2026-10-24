import { z } from "zod";

import {
  isoDate,
  optionalIsoDate,
  optionalText,
  optionalUuid,
  requiredText,
} from "@/lib/zod-helpers";
import { parseMoneyToMinor } from "@/lib/money";

const httpsLink = optionalText(2000).refine(
  (v) => v === null || /^https:\/\/\S+$/.test(v),
  "Use a full https:// link",
);

export const CADENCES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export const CADENCE_LABELS: Record<(typeof CADENCES)[number], [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  quarterly: ["quarter", "quarters"],
  yearly: ["year", "years"],
};
export function describeCadence(cadence: (typeof CADENCES)[number], interval: number): string {
  const [one, many] = CADENCE_LABELS[cadence];
  return interval === 1 ? `Every ${one}` : `Every ${interval} ${many}`;
}

export const routineFormSchema = z.object({
  name: requiredText("a routine name", 200),
  description: optionalText(5000),
  client_id: optionalUuid,
  cadence: z.enum(CADENCES),
  interval_count: z.coerce.number().int().min(1, "At least 1").max(52, "At most 52"),
  anchor_on: isoDate,
  owner_user_id: optionalUuid,
  runbook_url: httpsLink,
  is_active: z.boolean(),
});
export type RoutineFormInput = z.input<typeof routineFormSchema>;

export const routineRunSchema = z.object({
  run_id: z.uuid(),
  status: z.enum(["pending", "done", "skipped", "failed"]),
  notes: optionalText(5000),
});

export const DIAGNOSTIC_TYPE_SUGGESTIONS = [
  "Website audit",
  "SEO audit",
  "Security review",
  "Performance review",
  "Accessibility review",
  "AI readiness assessment",
];

export const diagnosticFormSchema = z.object({
  client_id: z.uuid("Choose a client"),
  diagnostic_type: requiredText("a type", 80),
  performed_on: isoDate,
  performed_by: optionalUuid,
  summary: requiredText("a summary", 10000),
  score: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && +v <= 100), "Score 0–100")
    .transform((v) => (v === "" ? null : Number(v))),
  report_url: httpsLink,
});
export type DiagnosticFormInput = z.input<typeof diagnosticFormSchema>;

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ISSUE_STATUSES = ["open", "triaged", "in_progress", "resolved", "wont_fix"] as const;
export const ISSUE_STATUS_LABELS: Record<(typeof ISSUE_STATUSES)[number], string> = {
  open: "Open",
  triaged: "Triaged",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export const issueFormSchema = z.object({
  client_id: z.uuid("Choose a client"),
  diagnostic_id: optionalUuid,
  title: requiredText("a title", 200),
  description: optionalText(10000),
  severity: z.enum(SEVERITIES),
  assignee_user_id: optionalUuid,
});
export type IssueFormInput = z.input<typeof issueFormSchema>;

export const issueStatusSchema = z
  .object({
    issue_id: z.uuid(),
    status: z.enum(ISSUE_STATUSES),
    resolution: optionalText(5000),
  })
  .refine((v) => !["resolved", "wont_fix"].includes(v.status) || v.resolution, {
    message: "Describe the resolution",
    path: ["resolution"],
  });

export const INVOICE_SYSTEMS = [
  "quickbooks",
  "stripe",
  "wave",
  "xero",
  "freshbooks",
  "other",
] as const;
export const INVOICE_SYSTEM_LABELS: Record<(typeof INVOICE_SYSTEMS)[number], string> = {
  quickbooks: "QuickBooks",
  stripe: "Stripe",
  wave: "Wave",
  xero: "Xero",
  freshbooks: "FreshBooks",
  other: "Other",
};
export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
export const INVOICE_STATUS_LABELS: Record<(typeof INVOICE_STATUSES)[number], string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const invoiceFormSchema = z
  .object({
    client_id: z.uuid("Choose a client"),
    project_id: optionalUuid,
    external_system: z.enum(INVOICE_SYSTEMS),
    external_number: requiredText("the invoice number", 60),
    external_url: httpsLink,
    issued_on: isoDate,
    due_on: optionalIsoDate,
    amount: z
      .string()
      .refine((v) => {
        const m = parseMoneyToMinor(v);
        return m !== undefined && m !== null;
      }, "Enter the invoice amount")
      .transform((v) => parseMoneyToMinor(v) as number),
    status: z.enum(INVOICE_STATUSES),
    paid_on: optionalIsoDate,
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.status === "paid" && !v.paid_on) {
      ctx.addIssue({ code: "custom", path: ["paid_on"], message: "Enter the paid date" });
    }
    if (v.due_on && v.due_on < v.issued_on) {
      ctx.addIssue({
        code: "custom",
        path: ["due_on"],
        message: "Due date can't be before issue date",
      });
    }
  });
export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;

// Display status: a sent invoice past its due date shows as overdue.
export function effectiveInvoiceStatus(
  status: (typeof INVOICE_STATUSES)[number],
  dueOn: string | null,
  today: string,
) {
  return status === "sent" && dueOn !== null && dueOn < today ? "overdue" : status;
}
