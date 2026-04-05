/**
 * Investment card catalog (docs/investment_cards.yaml).
 */

export type InvestmentDeckCard = {
  id: string;
  title: string;
  capital: string;
  concept: string;
  effect: string;
};

export type InvestmentDeckCategory = {
  id: string;
  title: string;
  cards: InvestmentDeckCard[];
};

export type InvestmentDeckYamlV1 = {
  version: 1;
  kind: "investment_deck_v1";
  title: string;
  companion_doc: string;
  intro: string;
  categories: InvestmentDeckCategory[];
  footer?: string;
};

export function isInvestmentDeckYamlV1(
  data: unknown
): data is InvestmentDeckYamlV1 {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { kind?: string }).kind === "investment_deck_v1"
  );
}

export function parseInvestmentDeckYamlV1(data: unknown): InvestmentDeckYamlV1 {
  if (!isInvestmentDeckYamlV1(data)) {
    throw new Error('Expected kind: "investment_deck_v1"');
  }
  return data;
}

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function renderInvestmentDeckYaml(doc: InvestmentDeckYamlV1): string {
  const out: string[] = [];
  out.push(`# ${doc.title}`);
  out.push("");
  out.push(doc.intro.trim());
  out.push("");

  for (const cat of doc.categories) {
    out.push(`### ${cat.title}`);
    out.push("");
    out.push(
      "| Working title | Suggested capital | Concept | Example effect (upright) |"
    );
    out.push("|---------------|---------------------|---------|---------------------------|");
    for (const c of cat.cards) {
      out.push(
        `| **${esc(c.title)}** | ${c.capital} | ${c.concept} | ${c.effect} |`
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
