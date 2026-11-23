// Types for worker/healthcheck.mjs (kept as plain JS so the container can run it without a build).
export function heartbeatIsFresh(path: string, maxAgeMs: number, now?: number): boolean;
