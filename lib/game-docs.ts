import fs from "fs";
import path from "path";
import YAML from "yaml";
import { renderYamlDocToMarkdown } from "./render-yaml-game-docs";

/**
 * Canonical game-design sources under /docs (filename per slug).
 * Card catalogs are YAML (parsed and rendered to Markdown for the rules UI).
 * Edit these files to tune cards and rules; the app reads them at runtime (`dynamic` routes).
 */
export const GAME_DOC_FILES = {
  "game-rules": "GAME_RULES.md",
  "bourbon-cards": "bourbon_cards.yaml",
  "resource-cards": "resource_cards.yaml",
  "operations-cards": "operations_cards.yaml",
  "investment-cards": "investment_cards.yaml",
} as const;

export type GameDocSlug = keyof typeof GAME_DOC_FILES;

export const GAME_DOC_TITLES: Record<GameDocSlug, string> = {
  "game-rules": "Game rules",
  "bourbon-cards": "Bourbon cards",
  "resource-cards": "Resource cards",
  "operations-cards": "Operations cards",
  "investment-cards": "Investment cards",
};

export function docsDir(): string {
  return path.join(process.cwd(), "docs");
}

export function gameDocPath(slug: GameDocSlug): string {
  return path.join(docsDir(), GAME_DOC_FILES[slug]);
}

/** Markdown for the rules UI (from `.md` or YAML → rendered Markdown). */
export function loadGameDoc(slug: GameDocSlug): string {
  const raw = fs.readFileSync(gameDocPath(slug), "utf8");
  if (slug === "game-rules") return raw;
  const data = YAML.parse(raw) as unknown;
  return renderYamlDocToMarkdown(slug, data);
}

/** Parsed YAML for card-catalog slugs; `null` for game rules (Markdown only). */
export function loadGameDocData(slug: GameDocSlug): unknown | null {
  if (slug === "game-rules") return null;
  const raw = fs.readFileSync(gameDocPath(slug), "utf8");
  return YAML.parse(raw) as unknown;
}

export function listGameDocSlugs(): GameDocSlug[] {
  return Object.keys(GAME_DOC_FILES) as GameDocSlug[];
}

export function isGameDocSlug(s: string): s is GameDocSlug {
  return s in GAME_DOC_FILES;
}
