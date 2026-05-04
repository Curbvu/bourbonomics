import type { NextConfig } from "next";

const config: NextConfig = {
  // Transpile the workspace engine package directly from its TS source so
  // we don't need a separate build step on the engine.
  transpilePackages: ["@bourbonomics/engine"],
};

export default config;
