// GET-only check that an origin is safe to put behind the /login worker.
// Refuses an upstream that redirects browsers to the public hostname (proxy loop)
// or that still serves Next assets at /_next (those would hit the marketing site).

const origin = (process.env.PREFLIGHT_ORIGIN ?? "https://pioneer-crm-two.vercel.app").replace(
  /\/$/,
  "",
);
const publicHost = "pioneerdigitalai.com";

async function get(path) {
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  return response;
}

function locationPath(location) {
  if (!location) return "";
  if (location.startsWith("/")) return location;
  const url = new URL(location);
  if (url.hostname === publicHost || url.hostname === `www.${publicHost}`) {
    throw new Error(
      `redirect names ${url.hostname} (${location}). Refusing: that loops the proxy.`,
    );
  }
  return url.pathname;
}

function isLoginPath(location) {
  const path = locationPath(location);
  return path === "/login" || path === "/login/";
}

const failures = [];
function check(label, ok, detail) {
  if (!ok) failures.push(`${label}: ${detail}`);
  else console.log(`ok  ${label}`);
}

const root = await get("/");
const rootLocation = root.headers.get("location") ?? "";
check(
  "GET /",
  root.status >= 300 && root.status < 400 && isLoginPath(rootLocation),
  `status ${root.status} location ${rootLocation || "(none)"}`,
);

const login = await get("/login");
const html = await login.text();
if (login.headers.get("location")) locationPath(login.headers.get("location"));
check("GET /login", login.status === 200, `status ${login.status}`);
check(
  "assets under /login/_next",
  html.includes("/login/_next/"),
  "HTML does not reference /login/_next/",
);
check(
  "no bare /_next asset urls",
  !html.includes('"/_next/') && !html.includes("'/_next/"),
  "HTML still references /_next/ at the host root",
);

const dashboard = await get("/login/dashboard");
const dashLocation = dashboard.headers.get("location") ?? "";
check(
  "GET /login/dashboard (anonymous)",
  dashboard.status >= 300 && dashboard.status < 400 && isLoginPath(dashLocation),
  `status ${dashboard.status} location ${dashLocation || "(none)"}`,
);

const manifest = await get("/login/manifest.webmanifest");
const manifestBody = manifest.ok ? await manifest.json() : null;
check("GET /login/manifest.webmanifest", manifest.status === 200, `status ${manifest.status}`);
check(
  "manifest scope stays on the mount",
  manifestBody?.scope === "/login/" && manifestBody?.start_url === "/login/dashboard",
  JSON.stringify(manifestBody),
);

const asset = html.match(/\/login\/_next\/static\/[^"'\s]+/)?.[0];
if (asset) {
  const file = await get(asset.split("?")[0]);
  check(`GET ${asset.split("?")[0]}`, file.status === 200, `status ${file.status}`);
} else if (login.status === 200) {
  failures.push("no /login/_next static url found to fetch");
}

if (failures.length) {
  console.error(failures.map((line) => `fail  ${line}`).join("\n"));
  process.exit(1);
}
console.log(`preflight passed for ${origin}`);
