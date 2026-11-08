import { createHash, createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

import { z } from "zod";

// Read-only Google access as the service account shared as Viewer on the Agency Dashboard sheet
// and the "Pioneer Results" folder (m8-setup runbook, archive/full-pioneer-os branch). Scopes are read-only; the account
// can only see what was shared with it.

const SCOPE = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const serviceAccountSchema = z.object({
  type: z.literal("service_account"),
  client_email: z.email(),
  private_key: z.string().startsWith("-----BEGIN PRIVATE KEY-----"),
});
export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

export async function loadServiceAccount(path: string): Promise<ServiceAccount> {
  const parsed = serviceAccountSchema.safeParse(JSON.parse(await readFile(path, "utf8")));
  if (!parsed.success) throw new Error("GOOGLE_SHEETS_KEY_FILE is not a service account key file");
  return parsed.data;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

// Signed JWT for Google's OAuth token exchange (RFC 7523).
export function buildAssertion(sa: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  return `${header}.${claims}.${b64url(signature)}`;
}

export type Fetch = typeof fetch;

// One signed-in service account, shared by the sheet and folder readers.
export class GoogleAuth {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly sa: ServiceAccount,
    readonly fetchImpl: Fetch = fetch,
  ) {}

  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: buildAssertion(this.sa),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Google sign-in failed (HTTP ${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }
}

export class SheetReader {
  constructor(
    private readonly auth: GoogleAuth,
    private readonly sheetId: string,
    private readonly tab: string,
  ) {}

  // All rows below the header, as arrays of cell text (columns A–G).
  async readRows(): Promise<string[][]> {
    const range = encodeURIComponent(`'${this.tab.replaceAll("'", "''")}'!A2:G`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.sheetId)}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
    const res = await this.auth.fetchImpl(url, {
      headers: { Authorization: `Bearer ${await this.auth.accessToken()}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Reading the results tab failed (HTTP ${res.status})`);
    const body = (await res.json()) as { values?: unknown[][] };
    return (body.values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
  }
}

// Columns: written_at | job_id | code | from | kind | client | text (m8-setup runbook §2)
export type ResultRow = {
  rowKey: string;
  jobId: string | null;
  code: string;
  from: string;
  kind: string;
  client: string;
  text: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rows are identified by their content (not their position), so moving rows doesn't replay them
// and an identical copy of a row is processed once.
export function toResultRow(cells: string[]): ResultRow | null {
  const [, jobId = "", code = "", from = "", kind = "", client = "", text = ""] = cells.map((c) =>
    c.trim(),
  );
  if (!jobId && !code && !text) return null;
  const rowKey = createHash("sha256")
    .update(JSON.stringify([jobId, code, from, kind, client, text]))
    .digest("hex");
  return {
    rowKey,
    jobId: UUID.test(jobId) ? jobId.toLowerCase() : null,
    code: code.slice(0, 200),
    from: from.toLowerCase().slice(0, 40),
    kind: kind.toLowerCase().slice(0, 40),
    client: client.slice(0, 200),
    text: text.slice(0, 20_000),
  };
}
