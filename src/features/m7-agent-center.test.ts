import { describe, expect, it } from "vitest";

import {
  agentFormSchema,
  aiPauseSchema,
  budgetSchema,
  jobCommandSchema,
  SELECTABLE_PROVIDERS,
  usageSchema,
} from "@/features/agents/schemas";

const agent = {
  name: "Sales Agent",
  role_summary: "",
  instructions: "",
  model: "",
  allowed_work_types: ["research"],
  is_active: true,
};

describe("M7 providers (D-24)", () => {
  it("offers only the approved stack", () => {
    expect(SELECTABLE_PROVIDERS).toEqual(["manual", "anthropic", "openrouter", "openai"]);
  });

  it("allows Grok for agents again (M8, D-36) but never Perplexity", () => {
    expect(agentFormSchema.safeParse({ ...agent, provider: "xai" }).success).toBe(true);
    expect(agentFormSchema.safeParse({ ...agent, provider: "perplexity" }).success).toBe(false);
  });

  it.each(["xai", "perplexity"])("refuses %s for costs and budgets", (provider) => {
    expect(usageSchema.safeParse({ provider, work_item_id: "", cost: "1", note: "" }).success).toBe(
      false,
    );
    expect(budgetSchema.safeParse({ provider, cap: "50" }).success).toBe(false);
  });

  it("does not record costs against the manual provider", () => {
    expect(
      usageSchema.safeParse({ provider: "manual", work_item_id: "", cost: "1", note: "" }).success,
    ).toBe(false);
  });

  it("accepts OpenRouter and OpenAI", () => {
    expect(agentFormSchema.safeParse({ ...agent, provider: "openrouter" }).success).toBe(true);
    expect(agentFormSchema.safeParse({ ...agent, provider: "openai" }).success).toBe(true);
  });
});

describe("M7 kill switch and jobs", () => {
  it("normalises an empty pause reason to null", () => {
    expect(aiPauseSchema.parse({ paused: true, reason: "  " })).toEqual({
      paused: true,
      reason: null,
    });
  });

  it("caps the pause reason", () => {
    expect(aiPauseSchema.safeParse({ paused: true, reason: "x".repeat(501) }).success).toBe(false);
  });

  it("only knows retry and cancel", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(jobCommandSchema.safeParse({ id, command: "retry" }).success).toBe(true);
    expect(jobCommandSchema.safeParse({ id, command: "delete" }).success).toBe(false);
    expect(jobCommandSchema.safeParse({ id: "nope", command: "cancel" }).success).toBe(false);
  });
});
