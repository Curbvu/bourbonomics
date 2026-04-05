/**
 * Structured operations deck design data (docs/operations_cards.yaml).
 * Game code can import these types and load the parsed YAML as config.
 */

export type OperationsDeckNotation = Record<string, string>;

export type OperationsDeckBalanceTarget = {
  label: string;
  detail: string;
};

export type OperationsDeckCard = {
  /** Stable id for code (snake_case). */
  id: string;
  /** Working title on the card. */
  title: string;
  concept: string;
  /** Rules text (Markdown ok). */
  effect: string;
};

export type OperationsDeckCategory = {
  id: string;
  title: string;
  cards: OperationsDeckCard[];
};

export type OperationsDeckYamlV1 = {
  version: 1;
  kind: "operations_deck_v1";
  title: string;
  /** Linked doc filename (e.g. GAME_RULES.md). */
  companion_doc: string;
  preamble: {
    /** Markdown body under “How operations cards use actions”. */
    how_actions: string;
    /** Maps notation token → explanation (e.g. B → Barons…). */
    notation: OperationsDeckNotation;
  };
  balance: {
    intro: string;
    targets: OperationsDeckBalanceTarget[];
    practical_recipe: string;
  };
  categories: OperationsDeckCategory[];
  /** Trailing design note (Markdown). */
  footer?: string;
};

export function isOperationsDeckYamlV1(
  data: unknown
): data is OperationsDeckYamlV1 {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { kind?: string }).kind === "operations_deck_v1"
  );
}

/** Use after `YAML.parse` / `loadGameDocData("operations-cards")`. */
export function parseOperationsDeckYamlV1(data: unknown): OperationsDeckYamlV1 {
  if (!isOperationsDeckYamlV1(data)) {
    throw new Error('Expected kind: "operations_deck_v1"');
  }
  return data;
}

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function formatNotation(n: OperationsDeckNotation): string {
  return Object.entries(n)
    .map(([k, v]) => `**${k}** = ${v}`)
    .join(" ");
}

/** Markdown for the rules UI (matches prior design-doc layout). */
export function renderOperationsDeckYaml(doc: OperationsDeckYamlV1): string {
  const out: string[] = [];
  out.push(`# ${doc.title}`);
  out.push("");
  out.push(
    `Companion to **[${doc.companion_doc}](${doc.companion_doc})**.`
  );
  out.push("");
  out.push("## How operations cards use actions");
  out.push("");
  out.push(doc.preamble.how_actions.trim());
  out.push("");
  out.push(`**Notation:** ${formatNotation(doc.preamble.notation)}.`);
  out.push("");
  out.push("---");
  out.push("");
  out.push("## Value calibration (deck-wide targets)");
  out.push("");
  out.push(doc.balance.intro.trim());
  out.push("");
  out.push("| Target | What it means |");
  out.push("|--------|----------------|");
  for (const t of doc.balance.targets) {
    out.push(`| **${esc(t.label)}** | ${t.detail} |`);
  }
  out.push("");
  out.push(doc.balance.practical_recipe.trim());
  out.push("");

  for (const cat of doc.categories) {
    out.push(`## ${cat.title}`);
    out.push("");
    out.push("| Working title | Concept | Example effect |");
    out.push("|---------------|---------|----------------|");
    for (const c of cat.cards) {
      out.push(
        `| **${esc(c.title)}** | ${c.concept} | ${c.effect} |`
      );
    }
    out.push("");
  }

  if (doc.footer?.trim()) {
    out.push(doc.footer.trim());
    out.push("");
  }

  return out.join("\n");
}
