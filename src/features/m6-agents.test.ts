import { describe, expect, it } from "vitest";

import {
  budgetSchema,
  buildPrompt,
  formatMicroUsd,
  usageSchema,
  workItemFormSchema,
} from "@/features/agents/schemas";

const UUID = "6f1c2e3a-1b2c-4d5e-8f90-123456789abc";

describe("buildPrompt", () => {
  it("puts role, task, context and output rules in order", () => {
    const prompt = buildPrompt({
      agentName: "Client Desk",
      agentInstructions: "Be concise.",
      title: "Follow-up",
      instructions: "Draft an email.",
      context: "## Client\n- Name: Synthetic Co",
    });
    const order = [
      "# Role: Client Desk",
      "Be concise.",
      "# Task: Follow-up",
      "# Context",
      "Synthetic Co",
      "# Output",
    ];
    let last = -1;
    for (const part of order) {
      const at = prompt.indexOf(part);
      expect(at, part).toBeGreaterThan(last);
      last = at;
    }
    expect(prompt).toContain("must be proposed, not done");
  });

  it("says so when the agent has no instructions or there is no context", () => {
    const prompt = buildPrompt({
      agentName: "X",
      agentInstructions: null,
      title: "T",
      instructions: "I",
      context: "",
    });
    expect(prompt).toContain("No saved instructions");
    expect(prompt).toContain("(No context included.)");
  });
});

describe("money in micro-dollars", () => {
  it("formats costs and parses dollars", () => {
    expect(formatMicroUsd(120_000)).toBe("$0.12");
    expect(formatMicroUsd(4_200)).toBe("$0.0042");
    expect(
      usageSchema.parse({ provider: "openrouter", work_item_id: "", cost: "0.42", note: "" }).cost,
    ).toBe(420_000);
    expect(
      usageSchema.safeParse({ provider: "openrouter", work_item_id: "", cost: "-1", note: "" })
        .success,
    ).toBe(false);
    expect(budgetSchema.parse({ provider: "anthropic", cap: "50" }).cap).toBe(5000);
  });
});

describe("workItemFormSchema", () => {
  const base = {
    agent_id: UUID,
    client_id: "",
    project_id: "",
    work_type: "research",
    title: "Scan",
    instructions: "Do it",
    context_options: {
      client: true,
      project: true,
      tasks: true,
      inputs: true,
      leads: true,
      contacts: false,
      notes: false,
      sows: false,
      invoices: false,
    },
  };
  it("requires every context switch and a known work type", () => {
    expect(workItemFormSchema.safeParse(base).success).toBe(true);
    expect(workItemFormSchema.safeParse({ ...base, work_type: "hack" }).success).toBe(false);
    const { contacts: _c, ...partial } = base.context_options;
    void _c;
    expect(workItemFormSchema.safeParse({ ...base, context_options: partial }).success).toBe(false);
  });
});
