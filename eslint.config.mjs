import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Import boundaries (docs/architecture.md §3):
//  - src/server/db/* only from src/server/** and src/features/*/server/** (type-only imports allowed).
//  - src/server/db/admin-client (secret key, bypasses RLS) only from scripts/**.
const adminClientPattern = {
  group: ["@/server/db/admin-client", "**/server/db/admin-client"],
  message: "The admin (secret-key) client may only be imported from scripts/**.",
};
// The invite helper holds the secret key; only the client-admin Server Actions may use it.
const portalInvitesPattern = {
  group: ["@/server/auth/portal-invites", "**/server/auth/portal-invites"],
  message: "The invite helper (secret key) may only be imported from client-admin Server Actions.",
};
const agentStorePattern = {
  group: ["@/server/agents/store", "**/server/agents/store", "./store"],
  allowTypeImports: true,
  message: "The agent store (secret key) may only be imported inside src/server/agents/.",
};
const serverDbPattern = {
  group: ["@/server/db/*", "**/server/db/*"],
  allowTypeImports: true,
  message: "Database clients are server-only: use src/server/** or src/features/*/server/**.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [adminClientPattern, serverDbPattern, portalInvitesPattern, agentStorePattern],
        },
      ],
    },
  },
  {
    files: ["src/server/**/*.ts", "src/features/*/server/**/*.ts", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [adminClientPattern, portalInvitesPattern, agentStorePattern] },
      ],
    },
  },
  {
    files: ["src/server/agents/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [adminClientPattern, portalInvitesPattern] }],
    },
  },
  {
    files: ["src/features/client-admin/server/actions.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [adminClientPattern] }],
    },
  },
  {
    files: ["src/server/db/admin-client.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
