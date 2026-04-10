import type { GameDocSlug } from "./game-docs";
import {
  isInvestmentDeckYamlV1,
  renderInvestmentDeckYaml,
} from "./investment-deck-yaml";
import {
  isOperationsDeckYamlV1,
  renderOperationsDeckYaml,
} from "./operations-deck-yaml";
import {
  isSpecialtyResourceCardsYamlV1,
  renderSpecialtyResourceCardsYaml,
} from "./resource-deck-yaml";

/** Parsed bourbon_cards.yaml */
export type BourbonCardsYaml = {
  version: number;
  kind?: "bourbon_cards_v1";
  intro?: { title?: string; body?: string };
  cards: BourbonCardYaml[];
};

export type BourbonCardYaml = {
  id: string;
  name: string;
  rarity: "Standard" | "Rare";
  /** Fixed 3×3: rows = age bands 2–3 / 4–7 / 8+; cols = demand Low / Mid / High */
  grid: number[][];
  awards: null | { silver: string; gold: string };
};

const BOURBON_DOC_DEMAND_HEADERS = ["Low (2–3)", "Mid (4–5)", "High (6+)"] as const;
const BOURBON_DOC_AGE_ROWS = ["2–3", "4–7", "8+"] as const;

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function renderBourbonCardsYaml(doc: BourbonCardsYaml): string {
  const lines: string[] = [];
  if (doc.intro?.body) {
    lines.push(`# ${doc.intro.title ?? "Bourbon cards"}`);
    lines.push("");
    lines.push(doc.intro.body.trim());
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  for (const c of doc.cards) {
    lines.push(`## ${c.id} — *${esc(c.name)}* — **${c.rarity}**`);
    lines.push("");
    const header = `| Age \\ Demand | ${BOURBON_DOC_DEMAND_HEADERS.map((h) => `**${h}**`).join(" | ")} |`;
    const sep = `|${"---|".repeat(1 + BOURBON_DOC_DEMAND_HEADERS.length)}`;
    const body = c.grid
      .map(
        (row, i) =>
          `| **${BOURBON_DOC_AGE_ROWS[i] ?? "?"}** | ${row.map((v) => `$${v}`).join(" | ")} |`
      )
      .join("\n");
    lines.push(header, sep, body, "");
    if (c.awards) {
      lines.push(
        `**Silver:** ${c.awards.silver} **Gold:** ${c.awards.gold}`
      );
    } else {
      lines.push(
        "*No Silver or Gold award on this card—price from the grid only.*"
      );
    }
    lines.push("", "---", "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function isBourbonCardsData(data: unknown): data is BourbonCardsYaml {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as BourbonCardsYaml).cards)
  );
}

export function renderYamlDocToMarkdown(
  slug: GameDocSlug,
  data: unknown
): string {
  if (slug === "operations-cards" && isOperationsDeckYamlV1(data)) {
    return renderOperationsDeckYaml(data);
  }
  if (slug === "investment-cards" && isInvestmentDeckYamlV1(data)) {
    return renderInvestmentDeckYaml(data);
  }
  if (slug === "resource-cards" && isSpecialtyResourceCardsYamlV1(data)) {
    return renderSpecialtyResourceCardsYaml(data);
  }
  switch (slug) {
    case "bourbon-cards":
      if (!isBourbonCardsData(data)) {
        throw new Error("Invalid bourbon cards YAML (expected cards array)");
      }
      return renderBourbonCardsYaml(data);
    default:
      throw new Error(`Not a YAML-backed slug: ${slug}`);
  }
}
