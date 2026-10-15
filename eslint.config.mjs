import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "out/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "video/tools/**",
    "video/build/**",
    "video/creator-colosseum/build/**",
    ".codex/**",
    "private/**",
  ]),
]);
