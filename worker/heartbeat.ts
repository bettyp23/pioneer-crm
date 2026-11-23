import { rename, writeFile } from "node:fs/promises";

// Records that the worker just completed a healthy loop (database reachable). Written to a temp
// file and renamed, so the health check never reads a half-written file. Holds only a time.
export async function writeHeartbeat(path: string, now: Date = new Date()): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${now.toISOString()}\n`, { mode: 0o644 });
  await rename(tmp, path);
}
