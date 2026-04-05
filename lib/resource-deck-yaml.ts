/**
 * Specialty resource catalog (docs/resource_cards.yaml).
 */

export type HowToReadRow = { column: string; meaning: string };

export type SpecialtyResourceCard = {
  id: string;
  name: string;
  hook: string;
  rule: string;
  /** Cross-type / promo rows */
  type_printed?: string;
};

export type SpecialtyResourceCategory = {
  id: string;
  title: string;
  /** When set, render a 4-column table (card / type / hook / rule). */
  table?: "card_type_hook_rule";
  cards: SpecialtyResourceCard[];
};

export type SpecialtyResourceCardsYamlV1 = {
  version: 1;
  kind: "specialty_resource_cards_v1";
  title: string;
  companion_doc: string;
  intro: string;
  how_to_read?: HowToReadRow[];
  icons_note?: string;
  categories: SpecialtyResourceCategory[];
  notes?: string[];
  related_docs?: { label: string; href: string }[];
};

export function isSpecialtyResourceCardsYamlV1(
  data: unknown
): data is SpecialtyResourceCardsYamlV1 {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { kind?: string }).kind === "specialty_resource_cards_v1"
  );
}

export function parseSpecialtyResourceCardsYamlV1(
  data: unknown
): SpecialtyResourceCardsYamlV1 {
  if (!isSpecialtyResourceCardsYamlV1(data)) {
    throw new Error('Expected kind: "specialty_resource_cards_v1"');
  }
  return data;
}

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function renderSpecialtyResourceCardsYaml(
  doc: SpecialtyResourceCardsYamlV1
): string {
  const out: string[] = [];
  out.push(`# ${doc.title}`);
  out.push("");
  out.push(doc.intro.trim());
  out.push("");

  if (doc.how_to_read?.length) {
    out.push("---");
    out.push("");
    out.push("## How to read these tables");
    out.push("");
    out.push("| Column | Meaning |");
    out.push("|--------|---------|");
    for (const row of doc.how_to_read) {
      out.push(`| **${esc(row.column)}** | ${row.meaning} |`);
    }
    out.push("");
  }

  if (doc.icons_note?.trim()) {
    const note = doc.icons_note.trim().replace(/\n+---\s*$/, "").trim();
    out.push(note);
    out.push("");
  }

  out.push("---");
  out.push("");

  for (const cat of doc.categories) {
    out.push(`## ${cat.title}`);
    out.push("");
    const wide = cat.table === "card_type_hook_rule";
    if (wide) {
      out.push("| Card | Type printed | Hook | Specialty rule |");
      out.push("|------|----------------|------|------------------|");
      for (const c of cat.cards) {
        out.push(
          `| **${esc(c.name)}** | ${c.type_printed ?? "—"} | ${c.hook} | ${c.rule} |`
        );
      }
    } else {
      out.push("| Card | Hook | Specialty rule |");
      out.push("|------|------|------------------|");
      for (const c of cat.cards) {
        out.push(`| **${esc(c.name)}** | ${c.hook} | ${c.rule} |`);
      }
    }
    out.push("");
  }

  if (doc.notes?.length) {
    out.push("## Deck-building notes");
    out.push("");
    for (const n of doc.notes) out.push(`- ${n}`);
    out.push("");
  }

  if (doc.related_docs?.length) {
    out.push("## Related docs");
    out.push("");
    for (const r of doc.related_docs) {
      out.push(`- **[${r.label}](${r.href})**`);
    }
    out.push("");
  }

  return out.join("\n");
}
