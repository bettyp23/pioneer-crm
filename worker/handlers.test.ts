import { describe, expect, it, vi } from "vitest";

import type { BeginResult, ClaimedJob, WorkerDb } from "./db";
import { handleSend, sha256Hex, WAIT_SECONDS, type Senders } from "./handlers";

function fakeDb(begin: BeginResult = "ok") {
  const db = {
    claimJobs: vi.fn(),
    beginDispatch: vi.fn<WorkerDb["beginDispatch"]>(async () => begin),
    markWaiting: vi.fn<WorkerDb["markWaiting"]>(async () => true),
    failJob: vi.fn<WorkerDb["failJob"]>(async () => undefined),
    filterNewRows: vi.fn(),
    acceptResult: vi.fn(),
    expireWaiting: vi.fn(),
    close: vi.fn(),
  } satisfies WorkerDb;
  return db;
}

function fakeSenders(ok = true): Senders & {
  claude: ReturnType<typeof vi.fn>;
  grok: ReturnType<typeof vi.fn>;
} {
  const result = ok
    ? { ok: true as const, externalRef: "session_1" }
    : { ok: false as const, error: "HTTP 503" };
  return { claude: vi.fn(async () => result), grok: vi.fn(async () => result) };
}

const claudeJob: ClaimedJob = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "claude.task",
  attempts: 1,
  payload: { message_id: "m1", mode: "auto", message: "Synthetic: what is open?" },
};
const grokJob: ClaimedJob = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "grok.dispatch",
  attempts: 1,
  payload: { message_id: "m2", client: "Test Client", task: "Synthetic: draft a follow-up" },
};

describe("handleSend", () => {
  it("sends Claude the code whose hash the database stored, then waits", async () => {
    const db = fakeDb();
    const send = fakeSenders();
    const outcome = await handleSend(claudeJob, "mac-1", db, send, () => "code-123");
    expect(outcome).toBe("sent");
    expect(db.beginDispatch).toHaveBeenCalledWith(
      claudeJob.id,
      "mac-1",
      sha256Hex("code-123"),
      WAIT_SECONDS["claude.task"],
    );
    const text = JSON.parse(send.claude.mock.calls[0]![0] as string);
    expect(text).toEqual({
      job_id: claudeJob.id,
      code: "code-123",
      mode: "auto",
      message: "Synthetic: what is open?",
    });
    expect(db.markWaiting).toHaveBeenCalledWith(claudeJob.id, "mac-1", "session_1");
  });

  it("sends Michael Scott the job ID, code, client and task", async () => {
    const db = fakeDb();
    const send = fakeSenders();
    await handleSend(grokJob, "mac-1", db, send, () => "code-456");
    expect(send.grok).toHaveBeenCalledWith({
      job_id: grokJob.id,
      code: "code-456",
      client: "Test Client",
      task: "Synthetic: draft a follow-up",
      blueprint_id: null,
    });
    expect(db.beginDispatch.mock.calls[0]![3]).toBe(WAIT_SECONDS["grok.dispatch"]);
  });

  it("never sends twice: an attempt that may already have gone out fails instead", async () => {
    const db = fakeDb("already_sent");
    const send = fakeSenders();
    expect(await handleSend(claudeJob, "mac-1", db, send)).toBe("failed");
    expect(send.claude).not.toHaveBeenCalled();
    expect(db.failJob.mock.calls[0]![2]).toMatch(/may already have gone out/);
  });

  it("sends nothing while the loop brake is on", async () => {
    const db = fakeDb("braked");
    const send = fakeSenders();
    expect(await handleSend(grokJob, "mac-1", db, send)).toBe("braked");
    expect(send.grok).not.toHaveBeenCalled();
    expect(db.failJob).not.toHaveBeenCalled();
  });

  it("marks a refused send failed, without retrying", async () => {
    const db = fakeDb();
    const send = fakeSenders(false);
    expect(await handleSend(claudeJob, "mac-1", db, send)).toBe("failed");
    expect(send.claude).toHaveBeenCalledTimes(1);
    expect(db.failJob).toHaveBeenCalledWith(claudeJob.id, "mac-1", "HTTP 503");
    expect(db.markWaiting).not.toHaveBeenCalled();
  });

  it("blocks a routed task with contact details before it reaches Michael Scott", async () => {
    const db = fakeDb();
    const send = fakeSenders();
    const routed: ClaimedJob = {
      ...grokJob,
      payload: { parent_job_id: claudeJob.id, task: "Email avery@northwind.example the draft" },
    };
    expect(await handleSend(routed, "mac-1", db, send)).toBe("blocked");
    expect(send.grok).not.toHaveBeenCalled();
    expect(db.beginDispatch).not.toHaveBeenCalled();
    expect(db.failJob.mock.calls[0]![2]).toMatch(/Email address/);
    expect(db.failJob.mock.calls[0]![2]).not.toMatch(/avery@/);
  });

  it("fails a send whose connection isn't set up, without counting it toward the brake", async () => {
    const db = fakeDb();
    const outcome = await handleSend(claudeJob, "mac-1", db, { claude: null, grok: null });
    expect(outcome).toBe("failed");
    expect(db.beginDispatch).not.toHaveBeenCalled();
    expect(db.failJob.mock.calls[0]![2]).toMatch(/CLAUDE_ROUTINE_URL/);
  });

  it("lets the owner's own confirmed message through to Michael Scott", async () => {
    const db = fakeDb();
    const send = fakeSenders();
    const own: ClaimedJob = { ...grokJob, payload: { task: "Email avery@northwind.example" } };
    expect(await handleSend(own, "mac-1", db, send)).toBe("sent");
  });
});
