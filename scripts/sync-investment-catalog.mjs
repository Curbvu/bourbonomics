/**
 * Reads canonical `docs/investment_catalog.yaml` and writes `lib/investmentCatalog.bundled.json`
 * for bundlers / Lambda. Run via `npm run sync:investments` or prebuild / predev.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yamlPath = join(root, "docs", "investment_catalog.yaml");
const outPath = join(root, "lib", "investmentCatalog.bundled.json");

const raw = readFileSync(yamlPath, "utf8");
const doc = parse(raw);

if (!doc || typeof doc !== "object" || !Array.isArray(doc.cards)) {
  throw new Error(`Expected investment_catalog.yaml with a top-level cards[] array`);
}

const ALLOWED_MODIFIER_KINDS = new Set([
  "action_cost_discount",
  "rickhouse_fee_discount",
  "market_buy_bonus_cards",
]);

function normalizeModifier(m, cardId) {
  if (!m || typeof m !== "object") throw new Error(`Card ${cardId}: invalid modifier`);
  const kind = m.kind;
  if (typeof kind !== "string" || !ALLOWED_MODIFIER_KINDS.has(kind)) {
    throw new Error(
      `Card ${cardId}: modifier kind must be one of ${[...ALLOWED_MODIFIER_KINDS].join(", ")}`
    );
  }
  if (kind === "action_cost_discount") {
    const amount = Number(m.amount);
    const scope = m.scope;
    if (!Number.isFinite(amount) || amount < 0 || amount > 20) {
      throw new Error(`Card ${cardId}: action_cost_discount.amount must be 0–20`);
    }
    if (scope !== "next_action" && scope !== "per_round_first_paid") {
      throw new Error(`Card ${cardId}: action_cost_discount.scope invalid`);
    }
    return { kind, amount: Math.floor(amount), scope };
  }
  if (kind === "rickhouse_fee_discount") {
    const amount = Number(m.amount);
    const oncePerRound = Boolean(m.oncePerRound);
    if (!Number.isFinite(amount) || amount < 0 || amount > 20) {
      throw new Error(`Card ${cardId}: rickhouse_fee_discount.amount must be 0–20`);
    }
    return { kind, amount: Math.floor(amount), oncePerRound };
  }
  if (kind === "market_buy_bonus_cards") {
    const extra = Number(m.extra);
    const oncePerRound = Boolean(m.oncePerRound);
    if (!Number.isFinite(extra) || extra < 1 || extra > 3) {
      throw new Error(`Card ${cardId}: market_buy_bonus_cards.extra must be 1–3`);
    }
    return { kind, extra: Math.floor(extra), oncePerRound };
  }
  throw new Error(`Card ${cardId}: unhandled modifier kind ${kind}`);
}

const cards = doc.cards.map((c) => {
  if (!c || typeof c !== "object") throw new Error("Invalid card entry");
  const {
    id,
    name,
    rarity,
    capital,
    short,
    effect,
    deckCopies: rawCopies,
    modifiers: rawMods,
  } = c;
  if (typeof id !== "string" || !id.length) throw new Error("Card missing id");
  if (typeof name !== "string") throw new Error(`Card ${id}: missing name`);
  if (typeof rarity !== "string") throw new Error(`Card ${id}: missing rarity`);
  const cap = Number(capital);
  if (!Number.isFinite(cap) || cap < 0 || cap > 999) throw new Error(`Card ${id}: bad capital`);
  if (typeof short !== "string") throw new Error(`Card ${id}: missing short`);
  if (typeof effect !== "string") throw new Error(`Card ${id}: missing effect`);
  let deckCopies = rawCopies == null ? 3 : Number(rawCopies);
  if (!Number.isFinite(deckCopies) || deckCopies < 1 || deckCopies > 99) {
    throw new Error(`Card ${id}: deckCopies must be 1–99`);
  }
  deckCopies = Math.floor(deckCopies);
  const modifiers = Array.isArray(rawMods)
    ? rawMods.map((m) => normalizeModifier(m, id))
    : [];
  return {
    id,
    name,
    rarity,
    capital: Math.floor(cap),
    short,
    effect,
    deckCopies,
    modifiers,
  };
});

const ids = new Set();
for (const c of cards) {
  if (ids.has(c.id)) throw new Error(`Duplicate card id: ${c.id}`);
  ids.add(c.id);
}

const payload = {
  meta: {
    source: "docs/investment_catalog.yaml",
    note: "Generated — edit the YAML only, then run npm run sync:investments",
  },
  cards,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${cards.length} investment cards → lib/investmentCatalog.bundled.json`);
