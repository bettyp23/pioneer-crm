import type { WorkerDb } from "./db";
import { toResultRow } from "./sheet";

export type PollSummary = { read: number; new: number; outcomes: Record<string, number> };

// Reads the results tab and hands each new row to the database, which decides whether it
// matches an open send (job ID + one-time code + sender). Row text is never interpreted here.
export async function processRows(rows: string[][], db: WorkerDb): Promise<PollSummary> {
  const parsed = rows.map(toResultRow).filter((r) => r !== null);
  const unique = [...new Map(parsed.map((r) => [r.rowKey, r])).values()];
  const fresh = new Set(unique.length ? await db.filterNewRows(unique.map((r) => r.rowKey)) : []);
  const outcomes: Record<string, number> = {};
  for (const row of unique) {
    if (!fresh.has(row.rowKey)) continue;
    const outcome = await db.acceptResult(row);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return { read: rows.length, new: fresh.size, outcomes };
}
