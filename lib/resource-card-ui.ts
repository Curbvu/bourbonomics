import displayDoc from "./resourceCardDisplay.generated.json";
import deckPools from "./resourceDeckPools.generated.json";
import {
  marketPileForResourceCard,
  resourceBaseKind,
} from "./resource-card-resolve";

export type ResourceCardTier =
  | "plain"
  | "special"
  | "strong"
  | "global_swing"
  | "detrimental";

const strongSet = new Set(deckPools.pools.strong_special ?? []);
const globalSet = new Set(deckPools.pools.global_swing ?? []);
const detSet = new Set(deckPools.pools.detrimental ?? []);
const specialSet = new Set(deckPools.pools.special ?? []);

const byId = (
  displayDoc as {
    byId?: Record<
      string,
      {
        name: string;
        hook: string;
        rule?: string;
        engine?: string;
        type_printed?: string;
      }
    >;
  }
).byId ?? {};

const PLAIN_FACE: Record<
  string,
  { title: string; character: string; glyph: string }
> = {
  Cask: { title: "Cask", character: "Oak backbone", glyph: "🪵" },
  Corn: { title: "Corn", character: "Sweet baseline", glyph: "🌽" },
  Barley: { title: "Barley", character: "Enzyme engine", glyph: "🌾" },
  Rye: { title: "Rye", character: "Spice & swing", glyph: "🌾" },
  Wheat: { title: "Wheat", character: "Soft & steady", glyph: "🌾" },
};

const TIER_GLYPH: Record<Exclude<ResourceCardTier, "plain">, string> = {
  special: "✦",
  strong: "★",
  global_swing: "⌁",
  detrimental: "☇",
};

const TIER_FALLBACK_CHARACTER: Record<
  Exclude<ResourceCardTier, "plain">,
  string
> = {
  special: "Seasoned ingredient",
  strong: "Barrel-proof rare",
  global_swing: "Moves the whole market",
  detrimental: "Soft setback — still playable",
};

function titleCaseFromId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function getResourceCardTier(cardId: string): ResourceCardTier {
  if (strongSet.has(cardId)) return "strong";
  if (globalSet.has(cardId)) return "global_swing";
  if (detSet.has(cardId)) return "detrimental";
  if (specialSet.has(cardId)) return "special";
  return "plain";
}

export type ResourceCardFace = {
  tier: ResourceCardTier;
  glyph: string;
  title: string;
  character: string;
};

export function getResourceCardFace(cardId: string): ResourceCardFace {
  const plain = PLAIN_FACE[cardId];
  if (plain) {
    return {
      tier: "plain",
      glyph: plain.glyph,
      title: plain.title,
      character: plain.character,
    };
  }
  const tier = getResourceCardTier(cardId);
  const meta = byId[cardId];
  const title = meta?.name?.trim() || titleCaseFromId(cardId);
  const hook = meta?.hook?.trim();
  const character =
    hook && hook.length > 0
      ? truncate(hook, 48)
      : tier !== "plain"
        ? TIER_FALLBACK_CHARACTER[tier]
        : "Straight bill ingredient";
  const glyph =
    tier === "plain" ? "📦" : TIER_GLYPH[tier as Exclude<ResourceCardTier, "plain">];
  return { tier, glyph, title, character };
}

const TIER_LABELS: Record<ResourceCardTier, string> = {
  plain: "Standard",
  special: "Special",
  strong: "Strong special (Tier A)",
  global_swing: "Global swing — demand (Tier B)",
  detrimental: "Soft negative",
};

const PLAIN_DETAILS: Record<string, { hook: string; rule: string }> = {
  Cask: {
    hook: "Oak backbone for every mash.",
    rule: "Every mash needs exactly one cask. You draw from the cask pile for plain oak or specialty barrels; specialty rules apply when you barrel, age, sell, or pay fees as printed. A plain cask has no extra rule line.",
  },
  Corn: {
    hook: "Sweet baseline for bourbon mash.",
    rule: "Bourbon mash requires at least one corn card (real mash bills are ≥51% corn). Plain corn has no extra rule; specialty corns add sell-time bonuses, mash-size tricks, or demand hedges as printed.",
  },
  Barley: {
    hook: "Enzyme engine; supporting grain.",
    rule: "Counts as grain for mash rules. Plain barley has no extra rule; specialty malts can shift age lookup, combo payouts, or rickhouse fees as printed.",
  },
  Rye: {
    hook: "Spice and market swing.",
    rule: "Counts as grain. Plain rye has no extra rule; specialty ryes often spike when demand is high or add bourbon draws on sell.",
  },
  Wheat: {
    hook: "Soft, consistent angle.",
    rule: "Counts as grain. Plain wheat has no extra rule; specialty wheats often smooth demand lookup or add age-only bonuses on sell.",
  },
};

export type ResourceCardDetails = {
  id: string;
  tier: ResourceCardTier;
  tierLabel: string;
  title: string;
  hook: string;
  rule: string;
  engine?: string;
  typePrinted?: string;
};

/** Full catalog copy for modals / tooltips (plain cards use curated blurbs; specialty uses YAML `rule`). */
export function getResourceCardDetails(cardId: string): ResourceCardDetails {
  const tier = getResourceCardTier(cardId);
  const tierLabel = TIER_LABELS[tier];
  const plainFace = PLAIN_FACE[cardId];
  const plainExtra = PLAIN_DETAILS[cardId];
  if (plainFace && plainExtra) {
    return {
      id: cardId,
      tier: "plain",
      tierLabel,
      title: plainFace.title,
      hook: plainExtra.hook,
      rule: plainExtra.rule,
    };
  }
  if (plainFace) {
    return {
      id: cardId,
      tier: "plain",
      tierLabel,
      title: plainFace.title,
      hook: plainFace.character,
      rule: "Standard resource with no printed specialty rule; it satisfies mash type requirements only.",
    };
  }
  const meta = byId[cardId];
  const title = meta?.name?.trim() || titleCaseFromId(cardId);
  const hook = meta?.hook?.trim() ?? "";
  const rule =
    meta?.rule?.trim() ||
    "This specialty has no rule text in the generated catalog. Re-run npm run sync:resource-cards or see docs/resource_cards.yaml.";
  const engine = meta?.engine?.trim();
  const typePrinted = meta?.type_printed?.trim();
  return {
    id: cardId,
    tier,
    tierLabel,
    title,
    hook: hook.length > 0 ? hook : "Flavor line",
    rule,
    ...(engine && engine.length > 0 ? { engine } : {}),
    ...(typePrinted && typePrinted.length > 0 ? { typePrinted } : {}),
  };
}

function pileSurfaceClass(cardId: string): string {
  const base =
    "border-2 bg-linear-to-b shadow-md ring-1 ring-black/5 dark:ring-white/10";
  const pile = marketPileForResourceCard(cardId);
  const k = resourceBaseKind(cardId);
  if (pile === "cask") {
    return `${base} border-rose-400/80 from-rose-100 to-rose-50 text-rose-950 dark:border-rose-500/60 dark:from-rose-950/70 dark:to-rose-900/40 dark:text-rose-50`;
  }
  if (pile === "corn") {
    return `${base} border-sky-400/80 from-sky-100 to-sky-50 text-sky-950 dark:border-sky-500/60 dark:from-sky-950/70 dark:to-sky-900/40 dark:text-sky-50`;
  }
  if (k === "barley") {
    return `${base} border-emerald-500/70 from-emerald-100 to-emerald-50 text-emerald-950 dark:border-emerald-500/50 dark:from-emerald-950/60 dark:to-emerald-900/35 dark:text-emerald-50`;
  }
  if (k === "rye") {
    return `${base} border-lime-500/70 from-lime-100 to-lime-50 text-lime-950 dark:border-lime-500/50 dark:from-lime-950/50 dark:to-lime-900/35 dark:text-lime-50`;
  }
  if (k === "wheat") {
    return `${base} border-amber-500/70 from-amber-100 to-amber-50 text-amber-950 dark:border-amber-500/50 dark:from-amber-950/55 dark:to-amber-900/35 dark:text-amber-50`;
  }
  return `${base} border-teal-500/70 from-teal-100 to-teal-50 text-teal-950 dark:border-teal-500/50 dark:from-teal-950/55 dark:to-teal-900/35 dark:text-teal-50`;
}

const TIER_HAND_CLASS: Record<ResourceCardTier, string> = {
  plain: "",
  special: "resource-hand-tier-special",
  strong: "resource-hand-tier-strong",
  global_swing: "resource-hand-tier-global",
  detrimental: "resource-hand-tier-bad",
};

export function handResourceChipClassNames(
  cardId: string,
  opts: { selected: boolean }
): string {
  const tier = getResourceCardTier(cardId);
  const surface = pileSurfaceClass(cardId);
  const tierMotion = TIER_HAND_CLASS[tier];
  const selected = opts.selected
    ? "resource-hand-selected relative z-[1] scale-[1.03] ring-4 ring-indigo-500/90 ring-offset-2 ring-offset-white shadow-xl dark:ring-cyan-400/90 dark:ring-offset-slate-900"
    : "";
  return `${surface} ${tierMotion} ${selected} rounded-xl`;
}

export function mashPillForResourceCard(cardId: string): {
  short: string;
  title: string;
  className: string;
} {
  const face = getResourceCardFace(cardId);
  const tier = face.tier;
  const base =
    "rounded-md border px-1 py-0.5 text-[7px] font-bold uppercase leading-none tracking-wide shadow-sm ring-1 ring-black/5 dark:ring-white/10 sm:text-[8px]";
  const tierMotion: Record<ResourceCardTier, string> = {
    plain: "",
    special: "resource-mash-tier-special",
    strong: "resource-mash-tier-strong",
    global_swing: "resource-mash-tier-global",
    detrimental: "resource-mash-tier-bad",
  };
  const pile = marketPileForResourceCard(cardId);
  let palette: string;
  if (pile === "cask") {
    palette =
      "border-rose-500/60 bg-rose-500/20 text-rose-950 dark:border-rose-400/50 dark:bg-rose-950/45 dark:text-rose-50";
  } else if (pile === "corn") {
    palette =
      "border-sky-500/60 bg-sky-500/20 text-sky-950 dark:border-sky-400/50 dark:bg-sky-950/45 dark:text-sky-50";
  } else {
    const k = resourceBaseKind(cardId);
    if (k === "barley") {
      palette =
        "border-emerald-600/60 bg-emerald-500/20 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-950/40 dark:text-emerald-50";
    } else if (k === "rye") {
      palette =
        "border-lime-600/60 bg-lime-500/25 text-lime-950 dark:border-lime-400/45 dark:bg-lime-950/35 dark:text-lime-50";
    } else if (k === "wheat") {
      palette =
        "border-amber-600/60 bg-amber-500/25 text-amber-950 dark:border-amber-400/45 dark:bg-amber-950/40 dark:text-amber-50";
    } else {
      palette =
        "border-teal-600/60 bg-teal-500/20 text-teal-950 dark:border-teal-400/45 dark:bg-teal-950/40 dark:text-teal-50";
    }
  }
  return {
    short: mashShortLabel(cardId, face),
    title: `${face.title} — ${face.character}`,
    className: `${base} ${palette} ${tierMotion[tier]}`,
  };
}

function mashShortLabel(cardId: string, face: ResourceCardFace): string {
  if (face.tier === "plain") {
    switch (cardId) {
      case "Cask":
        return "Cask";
      case "Corn":
        return "Corn";
      case "Barley":
        return "Bar";
      case "Rye":
        return "Rye";
      case "Wheat":
        return "Wht";
      default:
        return cardId.length > 4 ? `${cardId.slice(0, 3)}…` : cardId;
    }
  }
  const words = face.title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Spec";
  if (words.length === 1) return words[0]!.slice(0, 4);
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
