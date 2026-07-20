import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Map Game engine is pure TS and colocates its tests with the source.
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
