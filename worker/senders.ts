// The two outside calls. Each one is made at most once per attempt (the database refuses a
// second begin_dispatch), and nothing here retries.

export type SendResult = { ok: true; externalRef: string | null } | { ok: false; error: string };

type Fetch = typeof fetch;

const TIMEOUT_MS = 30_000;

// What Pioneer (Claude) receives as the routine-fire-payload. The saved prompt on the
// scheduled task tells it to answer or route, and to write one row to the results tab.
export function claudePayload(job: { id: string; payload: Record<string, unknown> }, code: string) {
  return JSON.stringify({
    job_id: job.id,
    code,
    mode: job.payload.mode === "answer" ? "answer" : "auto",
    message: String(job.payload.message ?? ""),
  });
}

// What Michael Scott's webhook receives (docs/runbooks/m8-setup.md §3).
export function grokPayload(job: { id: string; payload: Record<string, unknown> }, code: string) {
  return {
    job_id: job.id,
    code,
    client: typeof job.payload.client === "string" ? job.payload.client : null,
    task: String(job.payload.task ?? ""),
    blueprint_id: null,
  };
}

export async function fireClaude(
  cfg: { url: string; token: string },
  text: string,
  fetchImpl: Fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await fetchImpl(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `Claude task refused the send (HTTP ${res.status})` };
    const body = (await res.json().catch(() => ({}))) as { claude_code_session_id?: unknown };
    const ref =
      typeof body.claude_code_session_id === "string" ? body.claude_code_session_id : null;
    return { ok: true, externalRef: ref };
  } catch (e) {
    return { ok: false, error: `Claude task not reachable (${errorName(e)})` };
  }
}

export async function callGrok(
  cfg: { url: string; key: string },
  body: ReturnType<typeof grokPayload>,
  fetchImpl: Fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await fetchImpl(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok)
      return { ok: false, error: `Michael Scott's webhook refused the send (HTTP ${res.status})` };
    return { ok: true, externalRef: null };
  } catch (e) {
    return { ok: false, error: `Michael Scott's webhook not reachable (${errorName(e)})` };
  }
}

// Only the error's type, never its message: fetch errors can include the URL.
function errorName(e: unknown): string {
  if (e instanceof Error) return e.name === "TimeoutError" ? "timed out" : e.name;
  return "unknown error";
}
