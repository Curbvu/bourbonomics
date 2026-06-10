import type { NextConfig } from "next";

const config: NextConfig = {
  // Transpile the isolated prototype engine straight from its TS source —
  // no separate build step. The PROTOTYPE engine only; never the live one.
  transpilePackages: ["@bourbonomics/prototype-engine"],
};

export default config;
