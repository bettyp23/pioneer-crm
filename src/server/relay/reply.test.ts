import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { postReply, replyRowKey, type ReplyAcceptRow } from "./reply";

const KEY = "reply-key-correct";
const JOB = "33333333-3333-4333-8333-333333333333";

function body(overrides: Record<string, unknown> = {}) {
  return {
    job_id: JOB,
    code: "code-ms",
    from: "michael_scott",
    kind: "result",
    text: "The draft is ready.",
    ...overrides,
  };
}

function harness(
  outcome: string | ((row: ReplyAcceptRow) => string | Promise<string>) = "accepted",
) {
  const accept = vi.fn(async (row: ReplyAcceptRow) =>
    typeof outcome === "function" ? outcome(row) : outcome,
  );
  const post = (
    overrides: Record<string, unknown> = {},
    authorization: string | null = `Bearer ${KEY}`,
  ) =>
    postReply({
      authorization,
      body: body(overrides),
      replyKey: KEY,
      databaseConfigured: true,
      accept,
    });
  return { accept, post };
}

describe("postReply", () => {
  it("rejects a bad key before it touches the database", async () => {
    const { accept, post } = harness();
    expect((await post({}, "Bearer wrong-key")).status).toBe(401);
    expect((await post({}, null)).status).toBe(401);
    expect((await post({}, "Bearer ")).status).toBe(401);
    expect(accept).not.toHaveBeenCalled();
  });

  it("stays unavailable when the reply key or the database is not configured", async () => {
    const accept = vi.fn();
    const missingKey = await postReply({
      authorization: `Bearer ${KEY}`,
      body: body(),
      replyKey: null,
      databaseConfigured: true,
      accept,
    });
    expect(missingKey.status).toBe(503);
    const missingDb = await postReply({
      authorization: `Bearer ${KEY}`,
      body: body(),
      replyKey: KEY,
      databaseConfigured: false,
      accept: null,
    });
    expect(missingDb.status).toBe(503);
    expect(accept).not.toHaveBeenCalled();
  });

  it("rejects a body that is not a Michael Scott result", async () => {
    const { accept, post } = harness();
    expect((await post({ from: "pioneer_brain" })).status).toBe(400);
    expect((await post({ kind: "answer" })).status).toBe(400);
    expect((await post({ text: "  " })).status).toBe(400);
    expect(accept).not.toHaveBeenCalled();
  });

  it("posts an accepted reply through accept_result with the content hash", async () => {
    const { accept, post } = harness("accepted");
    const result = await post();
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ outcome: "accepted" });
    const row = accept.mock.calls[0]![0];
    expect(row.from).toBe("michael_scott");
    expect(row.kind).toBe("result");
    expect(row.code).toBe("code-ms");
    expect(row.client).toBe("");
    expect(row.rowKey).toBe(
      createHash("sha256")
        .update(
          JSON.stringify([JOB, "code-ms", "michael_scott", "result", "", "The draft is ready."]),
        )
        .digest("hex"),
    );
    expect(row.rowKey).toBe(replyRowKey(row));
  });

  it("returns a wrong code, an expired job, and a duplicate without dropping the database's words", async () => {
    const wrong = harness("ignored: wrong code");
    const wrongResult = await wrong.post();
    expect(wrongResult.status).toBe(422);
    expect(wrongResult.body).toEqual({ outcome: "ignored: wrong code" });

    const expired = harness("ignored: code expired");
    const expiredResult = await expired.post();
    expect(expiredResult.status).toBe(422);
    expect(expiredResult.body).toEqual({ outcome: "ignored: code expired" });

    const seen = new Set<string>();
    const { post } = harness(async (row) => {
      if (seen.has(row.rowKey)) return "duplicate";
      seen.add(row.rowKey);
      return "accepted";
    });
    expect((await post()).body).toEqual({ outcome: "accepted" });
    const again = await post();
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ outcome: "duplicate" });
  });

  it("does not put the database error in the response", async () => {
    const { post } = harness(async () => {
      throw new Error(
        "Relay database call relay_accept_result failed (HTTP 404) https://db.example/secret",
      );
    });
    const result = await post();
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "Relay failed" });
    expect(JSON.stringify(result.body)).not.toContain("db.example");
    expect(result.log).not.toContain("db.example");
  });
});
