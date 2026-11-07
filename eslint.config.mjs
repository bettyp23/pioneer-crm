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
      "no-restricted-imports": ["error", { patterns: [adminClientPattern, serverDbPattern] }],
    },
  },
  {
    files: ["src/server/**/*.ts", "src/features/*/server/**/*.ts", "src/proxy.ts"],
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
    ".cloudflare/**",
    ".vinext/**",
    "dist/**",
  ]),
]);

export default eslintConfig;
