import fs from "node:fs";
import path from "node:path";

import RulesViewer from "./RulesViewer";

export const dynamic = "force-static";

export const metadata = {
  title: "Bourbonomics — Rules",
  description: "The canonical rulebook.",
};

export default function RulesPage() {
  // Read the canonical rulebook from disk at build time. `process.cwd()`
  // during `next build` / `next dev` is the prototype app workspace, so two
  // levels up lands on the repo root.
  const docPath = path.resolve(process.cwd(), "../../docs/GAME_RULES.md");
  const markdown = fs.readFileSync(docPath, "utf8");
  return <RulesViewer markdown={markdown} />;
}
