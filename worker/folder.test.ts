import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { FolderReader, parseResultFile } from "./folder";
import { GoogleAuth, toResultRow } from "./sheet";

const JOB = "11111111-1111-4111-8111-111111111111";

describe("parseResultFile", () => {
  it("reads key: value lines, with a multi-line text at the end", () => {
    const row = parseResultFile(
      `job_id: ${JOB}\ncode: abc123\nfrom: michael_scott\nkind: result\nclient: TEST\ntext: Line one\nLine two`,
    );
    expect(row).toEqual([
      "",
      JOB,
      "abc123",
      "michael_scott",
      "result",
      "TEST",
      "Line one\nLine two",
    ]);
  });

  it("reads JSON", () => {
    const row = parseResultFile(
      JSON.stringify({
        job_id: JOB,
        code: "abc",
        from: "pioneer_brain",
        kind: "answer",
        text: "Hi",
      }),
    );
    expect(row).toEqual(["", JOB, "abc", "pioneer_brain", "answer", "", "Hi"]);
  });

  it("ignores files that aren't replies", () => {
    expect(parseResultFile("Meeting notes for Tuesday")).toBeNull();
    expect(parseResultFile("{not json")).toBeNull();
    expect(parseResultFile(`job_id: ${JOB}\ntext: no code`)).toBeNull();
  });

  it("gives a file the same key as the identical sheet row", () => {
    const fromFile = toResultRow(
      parseResultFile(
        `job_id: ${JOB}\ncode: c\nfrom: michael_scott\nkind: result\nclient: TEST\ntext: Done`,
      )!,
    );
    const fromSheet = toResultRow([
      "2026-10-29",
      JOB,
      "c",
      "michael_scott",
      "result",
      "TEST",
      "Done",
    ]);
    expect(fromFile!.rowKey).toBe(fromSheet!.rowKey);
  });
});

describe("FolderReader", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = {
    type: "service_account" as const,
    client_email: "reader@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };

  it("lists recent files in the folder only, exports Docs, downloads text and skips the rest", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://oauth2"))
        return Response.json({ access_token: "t", expires_in: 3600 });
      if (url.includes("/export?"))
        return new Response(`job_id: ${JOB}\ncode: doc\ntext: From a Doc`);
      if (url.includes("alt=media"))
        return new Response(JSON.stringify({ job_id: JOB, code: "txt", text: "x" }));
      return Response.json({
        files: [
          { id: "d1", name: JOB, mimeType: "application/vnd.google-apps.document" },
          { id: "t1", name: `${JOB}.json`, mimeType: "application/json", size: "80" },
          { id: "s1", name: "sheet", mimeType: "application/vnd.google-apps.spreadsheet" },
          { id: "b1", name: "big.txt", mimeType: "text/plain", size: "999999" },
        ],
      });
    });
    const reader = new FolderReader(
      new GoogleAuth(sa, fetchImpl as typeof fetch),
      "FOLDER_abcdef123",
    );
    const rows = await reader.readRows();
    expect(rows.map((r) => r[2])).toEqual(["doc", "txt"]);
    const list = new URL(String(fetchImpl.mock.calls[1]![0])).searchParams.get("q");
    expect(list).toContain("'FOLDER_abcdef123' in parents and trashed = false and modifiedTime >");
    expect(
      fetchImpl.mock.calls
        .map((c) => String(c[0]))
        .some((u) => u.includes("s1") || u.includes("b1")),
    ).toBe(false);
  });
});
