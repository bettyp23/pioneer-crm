import { mkdtemp, readFile, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { heartbeatIsFresh } from "./healthcheck.mjs";
import { writeHeartbeat } from "./heartbeat";

describe("worker heartbeat", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "pioneer-hb-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes only a timestamp", async () => {
    const path = join(dir, "hb");
    await writeHeartbeat(path, new Date("2026-11-23T12:00:00.000Z"));
    expect(await readFile(path, "utf8")).toBe("2026-11-23T12:00:00.000Z\n");
  });

  it("is healthy right after a heartbeat", async () => {
    const path = join(dir, "hb");
    await writeHeartbeat(path);
    expect(heartbeatIsFresh(path, 90_000)).toBe(true);
  });

  it("is unhealthy when the heartbeat is stale", async () => {
    const path = join(dir, "hb");
    await writeHeartbeat(path);
    const old = new Date(Date.now() - 5 * 60_000);
    await utimes(path, old, old);
    expect(heartbeatIsFresh(path, 90_000)).toBe(false);
  });

  it("is unhealthy when there has never been a heartbeat", () => {
    expect(heartbeatIsFresh(join(dir, "missing"), 90_000)).toBe(false);
  });
});
