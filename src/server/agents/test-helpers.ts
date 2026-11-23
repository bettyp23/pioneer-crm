import { vi } from "vitest";

import type { AgentStore, OutboundMessage } from "./store";

export const THREAD = "11111111-1111-4111-8111-111111111111";
export const MESSAGE = "22222222-2222-4222-8222-222222222222";

export function fakeStore(overrides: Partial<AgentStore> = {}) {
  const outbound: OutboundMessage = {
    id: MESSAGE,
    threadId: THREAD,
    body: "Plan the Northwind site",
    createdAt: "2026-11-23T12:00:00.000Z",
    sentFrom: "bettina",
  };
  let claimed = false;
  const store = {
    claimDelivery: vi.fn<AgentStore["claimDelivery"]>(async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    }),
    finishDelivery: vi.fn<AgentStore["finishDelivery"]>(async () => undefined),
    outboundMessage: vi.fn<AgentStore["outboundMessage"]>(async () => outbound),
    hermesRequest: vi.fn<AgentStore["hermesRequest"]>(async () => ({
      threadId: THREAD,
      body: "What time is it in Tampa?",
      history: [],
    })),
    routeMessage: vi.fn<AgentStore["routeMessage"]>(async () => true),
    recordReply: vi.fn<AgentStore["recordReply"]>(async () => ({
      messageId: "33333333-3333-4333-8333-333333333333",
      duplicate: false,
    })),
  } satisfies AgentStore;
  // Keep the mock types on the returned object (overrides are vi.fn mocks too).
  return Object.assign(store, overrides) as typeof store;
}
