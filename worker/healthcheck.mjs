// Container health check for the worker (plain Node, no build step):
//   node worker/healthcheck.mjs
// Healthy when WORKER_HEARTBEAT_FILE was touched within WORKER_HEARTBEAT_MAX_AGE_S seconds
// (default 90; the worker loops every 5 s). Prints one word; never reads settings beyond these two.
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function heartbeatIsFresh(path, maxAgeMs, now = Date.now()) {
  try {
    return now - statSync(path).mtimeMs <= maxAgeMs;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = process.env.WORKER_HEARTBEAT_FILE;
  const maxAgeS = Number(process.env.WORKER_HEARTBEAT_MAX_AGE_S ?? 90);
  const ok = Boolean(path) && heartbeatIsFresh(path, maxAgeS * 1000);
  console.log(ok ? "healthy" : "unhealthy");
  process.exit(ok ? 0 : 1);
}
