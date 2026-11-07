import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersResponseStoreSelfContainedConfig } from "@vinext/cloudflare/cache/config";

// Chat mutations call revalidatePath, so the response cache is the Workers
// Response Store on this same Worker. The Mac worker in worker/ is unrelated;
// this entrypoint is vinext's fetch handler, not worker/index.ts.
const cache = await createWorkersResponseStoreSelfContainedConfig({
  worker: "pioneer-crm-login",
  bucket: "pioneer-crm-login-response-store-cache-bodies",
});

export default defineConfig({
  accountId: "f513ddbf99c0286386bb98cac4d227b4",
  worker: defineWorker({
    ...cache,
    name: "pioneer-crm-login",
    entrypoint: "vinext/server/fetch-handler",
    // 2026-08-04 and later enable Node.js compatibility. Do not also set nodejs_compat.
    compatibilityDate: "2026-11-07",
    // No workers.dev or preview hostname. Public traffic is only the zone routes
    // the parent attaches after CI: /login and /login/* on the apex.
    workersDev: false,
    previewUrls: false,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      // Static files under the /login mount stay on the asset binding.
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ...cache.env,
      ASSETS: bindings.assets(),
    },
  }),
});
