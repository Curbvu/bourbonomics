import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // SST generates `.sst/platform/**` on `sst install` — it's vendored
    // SST platform code, not ours. Don't lint it.
    ".sst/**",
  ]),
  {
    // The SST v4 template uses a triple-slash reference at the top of
    // `sst.config.ts` to pull in the generated platform types. That's the
    // documented pattern and the only practical way to wire those types in;
    // the lint rule is a stylistic default that doesn't apply here.
    files: ["sst.config.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
]);

export default eslintConfig;
