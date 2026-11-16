# `/login` path proxy

Serves the minimal Pioneer CRM at `https://pioneerdigitalai.com/login` without moving the
domain. The marketing site stays on Cloudflare Pages (`pioneer-digital.pages.dev`) for `/` and
every path that is not the mount.

The Next.js app uses `basePath: /login`, and the sign-in page is the app root, so the public
URL is `/login` (not `/login/login`). Pages, server actions, and assets all live under that
prefix:

| Browser URL | What it is |
|---|---|
| `/login` | Sign in |
| `/login/mfa` | Authenticator code |
| `/login/dashboard` | Chat with Michael |
| `/login/no-access` | Signed in, no workspace |
| `/login/auth/sign-out` | POST sign-out |
| `/login/api/reply` | POST Michael's reply (`Authorization` is forwarded) |
| `/login/_next/*` | This app's JS and CSS |
| `/login/manifest.webmanifest` | Install manifest, scope `/login/` |

`/_next/*`, `/api/*`, `/`, `/services/`, and `/login-other` are not routed here. Marketing keeps them.

The worker fetches `https://pioneer-crm-two.vercel.app` and returns redirects as paths
(`/login/dashboard`), not as `https://pioneerdigitalai.com/...`. It does not follow redirects.
`www` is sent to the apex only for `/login` and `/login/*`.

Session cookies are host-only, `Path=/login`, `SameSite=Lax`. The marketing site does not
receive them. Supabase's site URL stays `https://pioneer-crm-two.vercel.app` (password sign-in
does not use that redirect). Do not point it at the public site.

## Order

1. Deploy this CRM commit to the existing production project and wait until
   `https://pioneer-crm-two.vercel.app` is READY. Do not attach `pioneerdigitalai.com` to that
   project.
2. From the repo root, with Node 24:

   ```sh
   node cloudflare/login-proxy/preflight.mjs
   ```

   Preflight must pass. It only sends GET requests.
3. From this directory, authenticated as the Cloudflare account that owns the zone
   (`f513ddbf99c0286386bb98cac4d227b4`, zone `pioneerdigitalai.com`):

   ```sh
   npx wrangler deploy
   ```

   That publishes worker `pioneer-login-proxy` and these routes only:

   - `pioneerdigitalai.com/login`
   - `pioneerdigitalai.com/login/*`
   - `www.pioneerdigitalai.com/login`
   - `www.pioneerdigitalai.com/login/*`

   Do not add `pioneerdigitalai.com/*`, `/login*`, `/_next/*`, or `/api/*`. Do not edit the
   victoryspinal worker, Pages project, or DNS.

## Rollback

Remove the worker and its routes. Pages serves `/login` again (404). The marketing home is
unchanged either way.

```sh
npx wrangler delete pioneer-login-proxy
```

To roll back the CRM as well, promote the previous Vercel production deployment of
`pioneer-crm-two`. Do not add a redirect from that host to `pioneerdigitalai.com`.

Delete the worker before reverting the CRM if both are live. An old CRM build references
`/_next` at the host root, which on the public site is the marketing bundle.
