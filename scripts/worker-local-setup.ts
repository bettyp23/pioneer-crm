// LOCAL ONLY: lets the pioneer_worker role log in to the local Supabase database and saves its
// connection string to .env.worker as WORKER_DATABASE_URL. The role still has no table access;
// it can only call the worker.* functions (M7, M8). Run: `npm run worker:setup-local`.
// Never point this at staging or production: there, an operator enables the role by hand.
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import pg from "pg";

// The Supabase CLI's well-known local superuser (same on every machine; not a secret).
const LOCAL_ADMIN_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ENV_FILE = ".env.worker";

async function main() {
  const password = randomBytes(24).toString("base64url");
  // Always 127.0.0.1 with the local default password, which no hosted database accepts.
  const client = new pg.Client({ connectionString: LOCAL_ADMIN_URL });
  await client.connect();
  try {
    await client.query(
      `alter role pioneer_worker with login password ${client.escapeLiteral(password)}`,
    );
  } finally {
    await client.end();
  }

  const url = `postgresql://pioneer_worker:${password}@127.0.0.1:54322/postgres`;
  const current = await readFile(ENV_FILE, "utf8").catch(() => "");
  if (current) await writeFile(`${ENV_FILE}.bak`, current, { mode: 0o600 });
  const kept = current
    .split("\n")
    .filter(
      (line) => !line.startsWith("WORKER_DATABASE_URL=") && line !== "# Pioneer worker (local)",
    );
  while (kept.length && kept.at(-1) === "") kept.pop();
  await writeFile(
    ENV_FILE,
    `${kept.join("\n")}\n\n# Pioneer worker (local)\nWORKER_DATABASE_URL=${url}\n`,
    {
      mode: 0o600,
    },
  );
  console.log("pioneer_worker can now log in locally; WORKER_DATABASE_URL saved to .env.worker.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
