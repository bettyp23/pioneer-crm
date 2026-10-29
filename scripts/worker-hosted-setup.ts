// HOSTED: lets the restricted pioneer_worker role log in to the hosted Supabase database and
// saves its login to .env.worker, so the worker on this Mac serves the Vercel site.
// Run: `npm run worker:setup-hosted` (docs/runbooks/hosted-setup.md). It asks for the database's
// admin connection string with hidden typing, uses it once, and never stores or prints it.
// The worker role still has no table access; it can only call the worker.* functions.
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

import pg from "pg";

const ENV_FILE = ".env.worker";
const DEFAULT_CA = `${homedir()}/.config/pioneer/supabase-ca.crt`;
// Supabase → Connect → "Session pooler": postgres.<ref>:<password>@<region>.pooler.supabase.com:5432
const ADMIN_URL =
  /^postgres(?:ql)?:\/\/postgres\.([a-z0-9]{20}):([^@]+)@([a-z0-9-]+\.pooler\.supabase\.com):5432\/postgres$/;

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    process.stdout.write(question);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (s.includes("\n")) write.call(rl, "\n");
    };
    rl.question("", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const caFile = process.env.WORKER_DATABASE_CA_FILE ?? DEFAULT_CA;
  if (!existsSync(caFile)) {
    throw new Error(
      `No certificate at ${caFile}. Download it from Supabase → Database settings → SSL configuration.`,
    );
  }
  const ca = await readFile(caFile, "utf8");

  const adminUrl = await askHidden(
    "Paste the Session pooler connection string with your database password filled in (hidden): ",
  );
  const m = ADMIN_URL.exec(adminUrl);
  if (!m) {
    throw new Error(
      "That isn't a Session pooler string (postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres).",
    );
  }
  const [, ref, , host] = m;

  const admin = new pg.Client({
    connectionString: adminUrl,
    ssl: { ca, rejectUnauthorized: true },
  });
  await admin.connect();
  const password = randomBytes(24).toString("base64url");
  try {
    const { rows } = await admin.query(
      `select exists (select 1 from pg_roles where rolname = 'pioneer_worker') as role,
              to_regprocedure('worker.accept_result(text, uuid, text, text, text, text, text)') is not null as m8`,
    );
    if (!rows[0]?.role || !rows[0]?.m8) {
      throw new Error("The hosted database doesn't have the M8 migrations yet. Apply them first.");
    }
    await admin.query(
      `alter role pioneer_worker with login password ${admin.escapeLiteral(password)}`,
    );
  } finally {
    await admin.end();
  }

  // Prove the worker login works through the pooler before saving it.
  const workerUrl = `postgresql://pioneer_worker.${ref}:${password}@${host}:5432/postgres`;
  const worker = new pg.Client({
    connectionString: workerUrl,
    ssl: { ca, rejectUnauthorized: true },
  });
  await worker.connect();
  try {
    await worker.query("select worker.filter_new_rows('{}')");
  } finally {
    await worker.end();
  }

  const current = await readFile(ENV_FILE, "utf8").catch(() => "");
  if (current) await writeFile(`${ENV_FILE}.bak`, current, { mode: 0o600 });
  const kept = current
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("WORKER_DATABASE_URL=") &&
        !line.startsWith("WORKER_DATABASE_CA_FILE=") &&
        line !== "# Pioneer worker (local)" &&
        line !== "# Pioneer worker (hosted database)",
    );
  while (kept.length && kept.at(-1) === "") kept.pop();
  await writeFile(
    ENV_FILE,
    `${kept.join("\n")}\n\n# Pioneer worker (hosted database)\nWORKER_DATABASE_URL=${workerUrl}\nWORKER_DATABASE_CA_FILE=${caFile}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Done: the worker can log in to the hosted database (TLS verified). Saved to .env.worker.",
  );
}

main().catch((e) => {
  // pg errors don't contain the password; never print the connection string itself.
  console.error(e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/\S+/g, "<hidden>") : e);
  process.exit(1);
});
