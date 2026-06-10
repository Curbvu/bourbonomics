import fs from "node:fs";
import path from "node:path";

import RulesViewer from "./RulesViewer";

export const dynamic = "force-static";

export default function RulesPage() {
  // This is the retired v1 (P1) live game; its rulebook is archived as
  // GAME_RULES_P1.md (the canonical GAME_RULES.md now describes the current
  // game). `process.cwd()` during `next build` / `next dev` is the client
  // workspace, so two levels up lands on the repo root.
  const docPath = path.resolve(process.cwd(), "../../docs/GAME_RULES_P1.md");
  const markdown = fs.readFileSync(docPath, "utf8");
  return <RulesViewer markdown={markdown} />;
}
