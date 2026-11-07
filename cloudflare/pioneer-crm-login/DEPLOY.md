# pioneer-crm-login

Native vinext Worker for the minimal CRM. It does not proxy Vercel. Marketing Pages
(`pioneer-digital.pages.dev`) keeps `/` and every path that is not this mount.

Do not attach zone routes until GitHub Actions on this branch is green, including
Playwright. This machine did not run Playwright (no Docker).

## Identity

| | |
|---|---|
| Worker name | `pioneer-crm-login` |
| Account | `f513ddbf99c0286386bb98cac4d227b4` |
| Zone | `pioneerdigitalai.com` `5a92c4b132deecf015d9f9af511af3fa` |
| Workers subdomain (read) | `victoryspinal` |
| Zone routes now | none |

`GET /accounts/{account}/workers/account-settings` returned only
`default_usage_model: standard` and `green_compute: false`. That does not say
Workers Free or Paid. Published limits (docs, 2026-09-04 and the Workers limits
page): uncompressed Worker size 64 MiB on both plans; CPU time 10 ms per HTTP
request on Free, default 30 seconds (max 5 minutes) on Paid. This build was not
measured in production CPU milliseconds. The local workerd log reports wall
time only (`GET /login/` 99 ms).

## This build (local, public placeholder env)

Uncompressed Worker modules (`.js` + `.wasm`, source maps excluded): **4,604,976 bytes**
(145 JS files, 56 wasm files). Per-file gzip sum: **1,601,357 bytes**. Static
assets: **44 files, 1,072,657 bytes**, under `/login/_next/`. Main module
`index.js` is 209 bytes and imports the rest. Output:
`.cloudflare/output/v0/workers/default/` (gitignored).

`NEXT_PUBLIC_*` values are inlined at `vite build`. Rebuild with the real public
values before upload. Do not upload this local build.

## Env names

The running app reads only these, both public (RLS is the data boundary):

| Name | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build time, inlined. Also read in `src/proxy.ts` and `src/lib/env.ts`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same. |

Not Worker config: `SUPABASE_SECRET_KEY` (bootstrap script only), `BOOTSTRAP_*`
(bootstrap script only), `WORKER_DATABASE_*` (the Mac worker in `worker/`, not
this Worker).

Set the two public names in the shell for `npm run build:vinext` /
`npm run deploy:vinext`. Plain Worker vars of the same names are optional
because the build inlines them. Do not mark them secret and do not add the
service-role key.

## Bindings the config declares

| Binding | Type | Resource name |
|---|---|---|
| `ASSETS` | assets | this Worker |
| `CACHE_BODIES` | R2 | `pioneer-crm-login-response-store-cache-bodies` |
| `CACHE_METADATA` | Durable Object, sqlite | export `CacheMetadata` on this Worker |
| `CF_VERSION_METADATA` | version metadata | — |

`revalidatePath` is why the response store is on. No KV, Hyperdrive, or service role.

## Routes (do not apply until CI is green)

```
pioneerdigitalai.com/login
pioneerdigitalai.com/login/*
www.pioneerdigitalai.com/login
www.pioneerdigitalai.com/login/*
```

`/login*` would also match `/login-other`. Do not use it. Do not route `/`,
`/_next/*`, or `/api/*`. `www` requests for those four patterns 308 to
`https://pioneerdigitalai.com` with the same path. Rollback is deleting these
four routes and the `pioneer-crm-login` Worker only.

## Upload

Supported command, after the public env is set and CI is green:

```sh
npx @vinext/cloudflare deploy
```

That is `cf` deploying `cloudflare.config.ts`. It creates the asset upload
session, uploads assets with the session token, then the script multipart.
Do not point it at Vercel. Do not change Pages, DNS, email, or victoryspinal.
