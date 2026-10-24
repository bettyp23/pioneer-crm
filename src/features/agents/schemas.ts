import { z } from "zod";

import { optionalText, optionalUuid, requiredText } from "@/lib/zod-helpers";

export const WORK_TYPES = [
  "research",
  "draft_message",
  "plan",
  "code",
  "qa",
  "operations",
  "other",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  research: "Research",
  draft_message: "Draft a message",
  plan: "Plan",
  code: "Code",
  qa: "QA / review",
  operations: "Operations",
  other: "Other",
};

export const PROVIDERS = [
  "manual",
  "xai",
  "anthropic",
  "perplexity",
  "openrouter",
  "openai",
] as const;
export type Provider = (typeof PROVIDERS)[number];
// Perplexity is retired (D-24). Grok is back as Michael Scott's team, reached through his
// webhook on the owner's Grok plan (D-34), so it is not offered for new API-based agents.
export const SELECTABLE_PROVIDERS = ["manual", "anthropic", "openrouter", "openai"] as const;
export type SelectableProvider = (typeof SELECTABLE_PROVIDERS)[number];
// Agents may also run on Grok (Michael Scott's team); budgets and the cost ledger may not.
export const AGENT_PROVIDERS = [...SELECTABLE_PROVIDERS, "xai"] as const;
export const PROVIDER_LABELS: Record<Provider, string> = {
  manual: "Manual",
  xai: "Grok",
  anthropic: "Anthropic (Claude)",
  perplexity: "Perplexity · retired",
  openrouter: "OpenRouter",
  openai: "OpenAI (Codex)",
};

export const WORK_STATUS_LABELS = {
  draft: "Draft",
  ready: "Ready to send",
  dispatched: "Sent to agent",
  returned: "Output received",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
} as const;
export type WorkStatus = keyof typeof WORK_STATUS_LABELS;

export const ACTION_TYPES = [
  "send_email",
  "deploy",
  "price_quote",
  "sign_contract",
  "publish_content",
  "other",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  send_email: "Send an email",
  deploy: "Deploy",
  price_quote: "Price / quote (owner)",
  sign_contract: "Sign a contract (owner)",
  publish_content: "Publish content",
  other: "Other",
};
export const ACTION_STATUS_LABELS = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
  executed: "Done",
  cancelled: "Cancelled",
} as const;

// Durable jobs (D-27): run by the Pioneer worker; people only watch, retry and cancel.
export const JOB_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  waiting_external: "Waiting for reply",
  succeeded: "Done",
  failed: "Failed",
  dead: "Gave up",
  cancelled: "Cancelled",
} as const;
export type JobStatus = keyof typeof JOB_STATUS_LABELS;

export const jobCommandSchema = z.object({ id: z.uuid(), command: z.enum(["retry", "cancel"]) });

export const aiPauseSchema = z.object({ paused: z.boolean(), reason: optionalText(500) });

// Context sections (D-22): business information by default; the rest opt-in and flagged.
export const CONTEXT_SECTIONS = {
  client: {
    label: "Client profile (name, industry, website, status)",
    default: true,
    optIn: false,
  },
  project: { label: "Project summary and progress", default: true, optIn: false },
  tasks: { label: "Project tasks and their status", default: true, optIn: false },
  inputs: { label: "Client inputs still outstanding", default: true, optIn: false },
  leads: { label: "Open leads (titles and stages)", default: true, optIn: false },
  contacts: { label: "Contacts with emails and phones", default: false, optIn: true },
  notes: { label: "Client notes and recent activity", default: false, optIn: true },
  sows: { label: "SOW titles and scope summaries", default: false, optIn: true },
  invoices: { label: "Invoice numbers and amounts", default: false, optIn: true },
} as const;
export type ContextSection = keyof typeof CONTEXT_SECTIONS;
export const CONTEXT_SECTION_KEYS = Object.keys(CONTEXT_SECTIONS) as ContextSection[];

const contextOptions = z.object(
  Object.fromEntries(CONTEXT_SECTION_KEYS.map((k) => [k, z.boolean()])) as Record<
    ContextSection,
    z.ZodBoolean
  >,
);

export const workItemFormSchema = z.object({
  agent_id: z.uuid("Choose an agent"),
  client_id: optionalUuid,
  project_id: optionalUuid,
  work_type: z.enum(WORK_TYPES),
  title: requiredText("a title", 200),
  instructions: requiredText("what the agent should do", 20000),
  context_options: contextOptions,
});
export type WorkItemFormInput = z.input<typeof workItemFormSchema>;

export const workTransitionSchema = z.object({
  id: z.uuid(),
  to: z.enum(["draft", "ready", "dispatched", "returned", "accepted", "rejected", "cancelled"]),
  expected_version: z.number().int().min(1),
  override_reason: optionalText(1000),
  output_text: optionalText(200000),
  output_url: optionalText(2000).refine(
    (v) => v === null || /^https:\/\/\S+$/.test(v),
    "Use an https:// link",
  ),
  review_note: optionalText(2000),
});

export const agentFormSchema = z.object({
  name: requiredText("a name", 120),
  role_summary: optionalText(1000),
  instructions: optionalText(20000),
  provider: z.enum(AGENT_PROVIDERS),
  model: optionalText(120),
  allowed_work_types: z.array(z.enum(WORK_TYPES)).min(1, "Pick at least one kind of work"),
  is_active: z.boolean(),
});
export type AgentFormInput = z.input<typeof agentFormSchema>;

export const proposedActionSchema = z.object({
  work_item_id: optionalUuid,
  client_id: optionalUuid,
  action_type: z.enum(ACTION_TYPES),
  title: requiredText("a title", 200),
  target: optionalText(500),
  details: requiredText("the details to approve", 50000),
  evidence_url: optionalText(2000).refine(
    (v) => v === null || /^https:\/\/\S+$/.test(v),
    "Use an https:// link",
  ),
});
export type ProposedActionInput = z.input<typeof proposedActionSchema>;

export const decideActionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected", "cancelled"]),
  expected_version: z.number().int().min(1),
  note: optionalText(2000),
});

export const usageSchema = z.object({
  provider: z.enum(SELECTABLE_PROVIDERS).exclude(["manual"]),
  work_item_id: optionalUuid,
  cost: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Enter dollars, e.g. 0.42")
    .transform((v) => Math.round(Number(v) * 1_000_000)),
  note: optionalText(500),
});

export const budgetSchema = z.object({
  provider: z.enum(SELECTABLE_PROVIDERS),
  cap: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter dollars, e.g. 50")
    .transform((v) => Math.round(Number(v) * 100)),
});

// Text handed to the agent (pasted into Claude or ChatGPT until Hermes is connected): its role,
// the task, the curated context.
export function buildPrompt(input: {
  agentName: string;
  agentInstructions: string | null;
  title: string;
  instructions: string;
  context: string;
}): string {
  return [
    `# Role: ${input.agentName}`,
    input.agentInstructions?.trim() || "(No saved instructions — add them on the agent's page.)",
    "",
    `# Task: ${input.title}`,
    input.instructions.trim(),
    "",
    "# Context (curated by Pioneer OS — do not ask for passwords, keys or personal data)",
    input.context.trim() || "(No context included.)",
    "",
    "# Output",
    "Reply with the deliverable only. Anything to send, deploy, price or sign must be proposed, not done.",
  ].join("\n");
}

export function formatMicroUsd(micro: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: micro % 10_000 === 0 ? 2 : 4,
  }).format(micro / 1_000_000);
}
