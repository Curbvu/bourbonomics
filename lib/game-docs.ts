import fs from "fs";
import path from "path";
import YAML from "yaml";
import { renderYamlDocToMarkdown } from "./render-yaml-game-docs";

/**
 * Canonical design sources under /docs (YAML card catalogs).
 * Parsed at runtime and shown as plain text (Markdown-style layout, no MD parser).
 */
export const GAME_DOC_FILES = {
  "bourbon-cards": "bourbon_cards.yaml",
  "resource-cards": "resource_cards.yaml",
  "operations-cards": "operations_cards.yaml",
  "investment-cards": "investment_cards.yaml",
} as const;

export type GameDocSlug = keyof typeof GAME_DOC_FILES;

export const GAME_DOC_TITLES: Record<GameDocSlug, string> = {
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

/** Plain-text doc for the rules UI (YAML → Markdown-shaped string for display). */
export function loadGameDoc(slug: GameDocSlug): string {
  const raw = fs.readFileSync(gameDocPath(slug), "utf8");
  const data = YAML.parse(raw) as unknown;
  return renderYamlDocToMarkdown(slug, data);
}

/** Parsed YAML for card-catalog slugs. */
export function loadGameDocData(slug: GameDocSlug): unknown {
  const raw = fs.readFileSync(gameDocPath(slug), "utf8");
  return YAML.parse(raw) as unknown;
}

export function listGameDocSlugs(): GameDocSlug[] {
  return Object.keys(GAME_DOC_FILES) as GameDocSlug[];
}

export function isGameDocSlug(s: string): s is GameDocSlug {
  return s in GAME_DOC_FILES;
}
