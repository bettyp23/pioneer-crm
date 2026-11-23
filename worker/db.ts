import pg from "pg";

// The worker logs in as pioneer_worker: no table access, only the worker.* functions (M7, M8).

export type ClaimedJob = {
  id: string;
  kind: string;
  attempts: number;
  payload: Record<string, unknown>;
};

export type BeginResult = "ok" | "braked" | "already_sent" | "not_held";

export type WorkerDb = {
  claimJobs(worker: string, kinds: string[], limit: number): Promise<ClaimedJob[]>;
  beginDispatch(
    jobId: string,
    worker: string,
    codeSha256: string,
    waitSeconds: number,
  ): Promise<BeginResult>;
  markWaiting(jobId: string, worker: string, externalRef: string | null): Promise<boolean>;
  failJob(jobId: string, worker: string, error: string): Promise<void>;
  filterNewRows(rowKeys: string[]): Promise<string[]>;
  acceptResult(row: {
    rowKey: string;
    jobId: string | null;
    code: string;
    from: string;
    kind: string;
    client: string;
    text: string;
  }): Promise<string>;
  expireWaiting(): Promise<number>;
  // Round trip that reads and changes nothing (hold mode and health).
  ping(): Promise<void>;
  close(): Promise<void>;
};

// A hosted database is always reached over TLS with its certificate verified (ca = its CA).
export function connect(databaseUrl: string, ca: string | null = null): WorkerDb {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: ca ? { ca, rejectUnauthorized: true } : false,
    max: 2,
    // A dropped network must surface as an error, not a query that waits forever.
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    keepAlive: true,
    idleTimeoutMillis: 60_000,
  });
  // An idle connection that breaks shouldn't crash the process; the next query reconnects.
  pool.on("error", () => undefined);
  const one = async <T>(sql: string, params: unknown[]): Promise<T> =>
    (await pool.query(sql, params)).rows[0]?.r as T;
  return {
    async claimJobs(worker, kinds, limit) {
      const { rows } = await pool.query(
        "select id, kind, attempts, payload from worker.claim_jobs($1, $2, $3)",
        [worker, kinds, limit],
      );
      return rows as ClaimedJob[];
    },
    beginDispatch: (jobId, worker, codeSha256, waitSeconds) =>
      one("select worker.begin_dispatch($1, $2, $3, $4) as r", [
        jobId,
        worker,
        codeSha256,
        waitSeconds,
      ]),
    markWaiting: (jobId, worker, externalRef) =>
      one("select worker.mark_waiting($1, $2, $3) as r", [jobId, worker, externalRef]),
    async failJob(jobId, worker, error) {
      await pool.query("select worker.fail_job($1, $2, $3, false)", [jobId, worker, error]);
    },
    filterNewRows: (rowKeys) => one("select worker.filter_new_rows($1) as r", [rowKeys]),
    acceptResult: (row) =>
      one("select worker.accept_result($1, $2, $3, $4, $5, $6, $7) as r", [
        row.rowKey,
        row.jobId,
        row.code,
        row.from,
        row.kind,
        row.client,
        row.text,
      ]),
    expireWaiting: () => one("select worker.expire_waiting() as r", []),
    async ping() {
      await pool.query("select 1");
    },
    close: () => pool.end(),
  };
}
