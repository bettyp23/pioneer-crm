import type { GoogleAuth } from "./sheet";

// Replies as files in the shared "Pioneer Results" Drive folder: one new file per reply, created
// by Michael Scott or the Claude task. Neither needs edit access to any existing file; Pioneer
// only reads (drive.readonly, and the service account sees only what was shared with it).

const DRIVE = "https://www.googleapis.com/drive/v3/files";
const MAX_BYTES = 100_000;
const GOOGLE_DOC = "application/vnd.google-apps.document";
const TEXT_TYPES = ["text/plain", "application/json", "text/markdown"];

type DriveFile = { id: string; name: string; mimeType: string; size?: string };

export class FolderReader {
  constructor(
    private readonly auth: GoogleAuth,
    private readonly folderId: string,
    // Replies older than this can't match an open send anymore (deadlines are ≤ 24 h).
    private readonly lookbackDays = 3,
  ) {}

  private async get(url: string): Promise<Response> {
    const res = await this.auth.fetchImpl(url, {
      headers: { Authorization: `Bearer ${await this.auth.accessToken()}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Reading the results folder failed (HTTP ${res.status})`);
    return res;
  }

  private async listRecent(): Promise<DriveFile[]> {
    const since = new Date(Date.now() - this.lookbackDays * 86_400_000).toISOString();
    const q = `'${this.folderId}' in parents and trashed = false and modifiedTime > '${since}'`;
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q,
        fields: "nextPageToken, files(id, name, mimeType, size)",
        orderBy: "modifiedTime desc",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const body = (await (await this.get(`${DRIVE}?${params}`)).json()) as {
        files?: DriveFile[];
        nextPageToken?: string;
      };
      files.push(...(body.files ?? []));
      pageToken = body.nextPageToken;
    } while (pageToken && files.length < 300);
    return files;
  }

  private async content(f: DriveFile): Promise<string | null> {
    if (f.size && Number(f.size) > MAX_BYTES) return null;
    const id = encodeURIComponent(f.id);
    if (f.mimeType === GOOGLE_DOC) {
      return (await this.get(`${DRIVE}/${id}/export?mimeType=text/plain`)).text();
    }
    if (TEXT_TYPES.includes(f.mimeType)) {
      return (await this.get(`${DRIVE}/${id}?alt=media&supportsAllDrives=true`)).text();
    }
    return null;
  }

  // Each readable reply file as the same seven cells as a sheet row.
  async readRows(): Promise<string[][]> {
    const rows: string[][] = [];
    for (const f of await this.listRecent()) {
      const text = await this.content(f);
      const row = text === null ? null : parseResultFile(text.slice(0, MAX_BYTES));
      if (row) rows.push(row);
    }
    return rows;
  }
}

const FIELDS = ["job_id", "code", "from", "kind", "client", "text"] as const;
type Field = (typeof FIELDS)[number];

// Accepts JSON ({"job_id": …}) or "key: value" lines; everything after "text:" is the text.
// Returns [written_at, job_id, code, from, kind, client, text], or null if it isn't a reply.
export function parseResultFile(raw: string): string[] | null {
  const content = raw.replace(/^﻿/, "").trim();
  const values: Partial<Record<Field, string>> = {};
  if (content.startsWith("{")) {
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      for (const f of FIELDS) if (json[f] !== undefined) values[f] = String(json[f]);
    } catch {
      return null;
    }
  } else {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*(job_id|code|from|kind|client|text)\s*[:=]\s?(.*)$/i.exec(lines[i]!);
      if (!m) continue;
      const key = m[1]!.toLowerCase() as Field;
      if (key === "text") {
        values.text = [m[2], ...lines.slice(i + 1)].join("\n").trim();
        break;
      }
      values[key] = m[2]!.trim();
    }
  }
  if (!values.job_id || !values.code) return null;
  return [
    "",
    values.job_id,
    values.code,
    values.from ?? "",
    values.kind ?? "",
    values.client ?? "",
    values.text ?? "",
  ];
}
