import { createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { WorkerDb } from "./db";
import { processRows } from "./results";
import { buildAssertion, GoogleAuth, SheetReader, toResultRow } from "./sheet";

const JOB = "11111111-1111-4111-8111-111111111111";
const row = (overrides: Partial<Record<number, string>> = {}) => {
  const cells = [
    "2026-10-24 10:00",
    JOB,
    "code-1",
    "pioneer_brain",
    "answer",
    "",
    "Synthetic reply",
  ];
  for (const [i, v] of Object.entries(overrides)) cells[Number(i)] = v!;
  return cells;
};

describe("toResultRow", () => {
  it("reads the seven columns and normalises sender and kind", () => {
    const r = toResultRow(row({ 3: " Pioneer_Brain ", 4: "ANSWER" }))!;
    expect(r).toMatchObject({ jobId: JOB, code: "code-1", from: "pioneer_brain", kind: "answer" });
    expect(r.rowKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("identifies a row by content, not by when it was written or where it sits", () => {
    expect(toResultRow(row())!.rowKey).toBe(toResultRow(row({ 0: "2026-10-25 09:00" }))!.rowKey);
    expect(toResultRow(row())!.rowKey).not.toBe(toResultRow(row({ 6: "Other reply" }))!.rowKey);
  });

  it("keeps a malformed job ID as unknown and skips empty rows", () => {
    expect(toResultRow(row({ 1: "not-a-uuid" }))!.jobId).toBeNull();
    expect(toResultRow(["", "", "", "", "", "", ""])).toBeNull();
    expect(toResultRow([])).toBeNull();
  });
});

describe("processRows", () => {
  it("sends only new, distinct rows to the database and counts the outcomes", async () => {
    const accepted = toResultRow(row())!;
    const db = {
      filterNewRows: vi.fn(async (keys: string[]) => keys.filter((k) => k !== accepted.rowKey)),
      acceptResult: vi.fn(async () => "ignored: wrong code"),
    } as unknown as WorkerDb;
    const summary = await processRows(
      [row(), row(), row({ 2: "other" }), ["", "", "", "", "", "", ""]],
      db,
    );
    expect(summary).toEqual({ read: 4, new: 1, outcomes: { "ignored: wrong code": 1 } });
    expect(db.acceptResult).toHaveBeenCalledTimes(1);
  });
});

describe("Google sign-in", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = {
    type: "service_account" as const,
    client_email: "reader@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };

  it("signs a read-only, one-hour assertion for the token endpoint", () => {
    const jwt = buildAssertion(sa, 1_000);
    const [h, c, s] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(claims).toEqual({
      iss: sa.client_email,
      scope:
        "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000,
      exp: 4_600,
    });
    expect(
      createVerify("RSA-SHA256")
        .update(`${h}.${c}`)
        .verify(publicKey, Buffer.from(s!, "base64url")),
    ).toBe(true);
  });

  it("reads columns A–G below the header of the named tab, reusing its token", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).startsWith("https://oauth2")
        ? Response.json({ access_token: "tok", expires_in: 3600 })
        : Response.json({ values: [row(), ["x"]] }),
    );
    const reader = new SheetReader(
      new GoogleAuth(sa, fetchImpl as typeof fetch),
      "SHEETID_abcdefghijklmnop",
      "Pioneer Results",
    );
    expect(await reader.readRows()).toEqual([row(), ["x"]]);
    await reader.readRows();
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.startsWith("https://oauth2"))).toHaveLength(1);
    expect(urls[1]).toContain(encodeURIComponent("'Pioneer Results'!A2:G"));
  });
});
