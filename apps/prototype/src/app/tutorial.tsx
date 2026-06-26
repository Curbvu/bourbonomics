"use client";

// Bourbonomics — guided tutorial. A controlled, spotlighted walk through one
// full round (Demand → Collect → Play → age → Sell), in the spirit of the
// original game's tutorial.
//
// Each "beat" either shows a prompt (read + Continue) or AWAITS a specific
// player action. While a beat is active, the board's dispatch is gated: actions
// that aren't part of the current step are blocked with a nudge, and the beat
// only advances once the player performs the taught action (which is therefore
// "recorded" as the advance). Beats can rig the engine state on entry so the
// scenario stays deterministic (a fillable order, useful dice, a simple bill, a
// barrel aged to sellable).

import { useEffect, useState } from "react";
import { createGame } from "@bourbonomics/prototype-engine";
import type {
  Action,
  DemandCard,
  GameState,
  MashBill,
  ResourceCard,
  ResourceKind,
} from "@bourbonomics/prototype-engine";

// ── tokens (kept local so this module doesn't depend on GameClient) ───
const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";
// The overlay card stays a warm dark walnut (like the board's Table Log) for
// contrast against the parchment board; accents match the new amber/brass CTAs.
const T = { ink: "#f6ecd6", text2: "#cbb893", muted: "#9c876a", gold: "#e7b765", brass: "#cf9a5e", border: "#5a3f25", green: "#6db28c" };

// ── rigging helpers (deterministic scenario) ─────────────────────────
function res(kind: ResourceKind, i: number): ResourceCard {
  const names: Record<ResourceKind, string> = {
    cask: "New-Char Cask", corn: "Corn", rye: "Rye", wheat: "Wheat", barley: "Barley",
  };
  return { id: `tut_${kind}_${i}`, defId: `res_${kind}_common`, kind, quality: "common", name: names[kind], placeholder: true };
}

function singleBarrelBill(i: number): MashBill {
  // The bourbon rule: 1 cask + 1 corn + ≥1 grain.
  const recipe: Partial<Record<ResourceKind, number>> = { cask: 1, corn: 1, barley: 1 };
  return {
    id: `tut_sb_${i}`, defId: "mb_single_barrel", name: "Single Barrel Select",
    traits: ["clean"], expression: "bourbon", styleTag: "classic", tags: ["classic"],
    recipe, batchQtyBias: 0, primeStart: 6, primeEnd: 8, placeholder: true,
  };
}

function houseOrder(): DemandCard {
  return {
    id: "tut_order", defId: "dm_house", label: "House Pour", requirement: {},
    slotMultiple: 1, slotsActive: 1, filledBy: [null],
    reputation: 3, placeholder: true,
  };
}

const recipeSize = (r: Partial<Record<ResourceKind, number>>) =>
  (Object.values(r) as (number | undefined)[]).reduce<number>((s, n) => s + (n ?? 0), 0);

/** A fresh 1-player tutorial game ("You", no AI). */
export function tutorialGame(): GameState {
  return createGame({ seed: 7, playerNames: ["You"], botFlags: [false] });
}

// ── beat model ───────────────────────────────────────────────────────
export interface TutBeat {
  id: string;
  title: string;
  body: string;
  /** data-tut value of the element to spotlight (none = no spotlight). */
  spotlight?: string;
  /** During the dice draft: once `count` dice are tapped, move the halo to `target`. */
  spotlightAfterDraft?: { count: number; target: string };
  /** In the bill picker: once `count` bills are selected, move the halo to `target`. */
  spotlightAfterPick?: { count: number; target: string };
  /** Prompt beats set a Continue label; await beats leave it undefined. */
  cta?: string;
  /** One-line "do this" nudge shown on await beats / when a blocked action is tried. */
  hint?: string;
  /** Await beats: which actions are legal right now (others are blocked). */
  allow?: (a: Action, g: GameState) => boolean;
  /** Advance when this action is dispatched + applied. */
  goal?: (a: Action, g: GameState) => boolean;
  /** Advance when the post-action state satisfies this (accumulating steps). */
  advanceWhen?: (g: GameState) => boolean;
  /** Rig the engine state when this beat becomes active. Must be pure. */
  onEnter?: (g: GameState) => GameState;
  /** Advance as soon as the player OPENS the mash-bill picker (a local UI action). */
  advanceOnDrawOpen?: boolean;
  /** Step counter shown on the card. */
  step?: number;
}

const TOTAL_STEPS = 7;

export const TUT_BEATS: TutBeat[] = [
  {
    id: "welcome",
    title: "Welcome to Bourbonomics",
    body: "You run a bourbon distillery. The table sits to the **left**, the **center stage** changes with each phase, and **the Market** is on the right — with a live **Table Log** narrating every move along the bottom. Each round you read **demand**, gather **resources**, age **bourbon**, and sell into **orders**. Let's walk one round together.",
    cta: "Begin",
  },
  {
    id: "market",
    title: "The demand market",
    body: "Orders stack here from the floor up — the higher the pile, the **hotter the zone** and the more each sale pays. Fill an order's slots to **complete** it and keep it as **prestige**. We've lined up one simple order: a House Pour.",
    spotlight: "market",
    cta: "Got it",
    onEnter: (g) => ({ ...structuredClone(g), demandCards: [houseOrder()] }),
  },
  {
    id: "collect-intro",
    title: "Collect Resources",
    body: "Now you gather what you'll brew with. First you'll **draw a recipe** so you know what grain to chase, then **roll & draft dice** for it — each die is a **cask**, a **grain** (corn / rye / wheat / barley), or a wild **✦** for any pile.",
    spotlight: "begin",
    cta: "Next",
  },
  {
    id: "begin",
    title: "Open the dice draft",
    body: "Each round opens with Demand, then the **Collect** dice draft. Press **Begin the Collect draft** to roll your Supply dice.",
    spotlight: "begin",
    hint: "Press Begin the Collect draft.",
    step: 1,
    allow: (a) => a.type === "BEGIN_COLLECT",
    goal: (a) => a.type === "BEGIN_COLLECT",
  },
  {
    id: "draw-open",
    title: "Draw a mash bill",
    body: "Your Collect turn opens by picking a **recipe** — so you know what grain to gather. Every **open barrel slot** can pull a mash bill: press **Draw a mash bill**. We've stocked a simple one for you.",
    spotlight: "draw",
    hint: "Press Draw a mash bill on an open slot.",
    step: 2,
    advanceOnDrawOpen: true,
    // stock a simple bill offer; the turn's draw allowance is fresh.
    onEnter: (g) => {
      const d = structuredClone(g);
      d.mashBillSupply = [singleBarrelBill(0), singleBarrelBill(1), singleBarrelBill(2), ...d.mashBillSupply];
      d.players[0]!.drewMashBillsThisTurn = false;
      return d;
    },
    allow: () => false, // only opening the picker (a local action) advances this step
  },
  {
    id: "draw-keep",
    title: "Keep the recipe",
    body: "These are the mash bills you drew. Pick a **Single Barrel Select**, then press **Keep** to rest it in your rickhouse — now you can see exactly which grain to draft.",
    spotlight: "bills",
    spotlightAfterPick: { count: 1, target: "keep" },
    hint: "Tap a Single Barrel Select, then Keep.",
    step: 3,
    allow: (a) => a.type === "DRAW_MASH_BILLS" && a.keepIndexes.length >= 1,
    goal: (a) => a.type === "DRAW_MASH_BILLS",
  },
  {
    id: "draft",
    title: "Draft your resources",
    body: "Now gather the grain your recipe needs. Each die is a resource — **cask, corn, rye, barley**. Tap **all four dice** (watch them fly to your Warehouse), then press **Claim & pass**.",
    spotlight: "dice",
    // once all four are tapped, move the halo to the Claim & pass button.
    spotlightAfterDraft: { count: 4, target: "pass" },
    hint: "Tap all four dice, then press Claim & pass.",
    step: 4,
    // dice rolled on BEGIN_COLLECT — rig the faces to exactly one of each resource.
    onEnter: (g) => {
      const d = structuredClone(g);
      const faces: ResourceKind[] = ["cask", "corn", "rye", "barley"];
      if (d.collect) d.collect.dice = d.collect.dice.map((die, i) => ({ ...die, face: faces[i] ?? "corn" }));
      return d;
    },
    allow: (a) => (a.type === "COLLECT_CLAIM" ? a.claims.length >= 4 : a.type === "COLLECT_ROLL"),
    goal: (a) => a.type === "COLLECT_CLAIM",
  },
  {
    id: "stage",
    title: "Stage your resources",
    body: "Now in **Play**, move your **cask**, **corn**, and **grain** onto the recipe. Staged cards lock to the barrel and free Warehouse space. Use **Stage** until the recipe is full.",
    spotlight: "resting",
    hint: "Stage each resource the recipe needs.",
    step: 5,
    // safety: ensure the recipe's grain is on hand (the draft should have supplied it).
    onEnter: (g) => {
      const d = structuredClone(g);
      const hand = d.players[0]!.hand;
      for (const k of ["cask", "corn", "barley"] as ResourceKind[]) {
        if (!hand.some((c) => c.kind === k)) hand.push(res(k, 1));
      }
      return d;
    },
    allow: (a) => a.type === "STAGE",
    advanceWhen: (g) =>
      g.players[0]!.rickhouse.some((b) => !b.built && b.staged.length >= recipeSize(b.recipe)),
  },
  {
    id: "make",
    title: "Make the bourbon",
    body: "The recipe's full — press **Build now** to barrel it. It begins **aging** at year 0.",
    spotlight: "resting",
    hint: "Press Build now.",
    step: 6,
    allow: (a) => a.type === "MAKE_BOURBON",
    goal: (a) => a.type === "MAKE_BOURBON",
  },
  {
    id: "age",
    title: "Years pass…",
    body: "Bourbon needs time in oak. We'll skip ahead to **year 2** — the minimum age to sell.",
    cta: "Skip ahead ⏵",
    onEnter: (g) => {
      const d = structuredClone(g);
      const b = d.players[0]!.rickhouse.find((x) => x.built);
      if (b) b.age = Math.max(b.age, 2);
      return d;
    },
  },
  {
    id: "sell",
    title: "Sell into demand",
    body: "Your bourbon is ready. **Tap the barrel**, then route it to the **House Pour** order. Every sale banks **Capital** — and filling the order's last slot **completes** it for **prestige**.",
    spotlight: "aging",
    hint: "Tap the aged barrel, then pick the House Pour order.",
    step: 7,
    allow: (a) => a.type === "SELL",
    goal: (a) => a.type === "SELL",
  },
  {
    id: "done",
    title: "That's the loop!",
    body: "**Demand → Collect → Play → age → repeat** until someone completes **8 orders**. You bank **Capital** from every sale and **prestige** from finishing orders — most points wins. Grow your **five departments** to draw harder, hold more, and sell richer. Now play a full game!",
    cta: "Finish",
  },
];

// ── spotlight + instruction overlay ──────────────────────────────────
function useRect(selector: string | undefined): DOMRect | null {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) { setBox(null); return; }
    const measure = () => {
      const el = document.querySelector(`[data-tut="${selector}"]`);
      const next = el?.getBoundingClientRect() ?? null;
      setBox((prev) => {
        if (!prev || !next) return next;
        if (Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5) return prev;
        return next;
      });
    };
    measure();
    const id = window.setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => { window.clearInterval(id); window.removeEventListener("resize", measure); };
  }, [selector]);
  return box;
}

function Rich({ children }: { children: string }) {
  const parts: { t: string; b: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(children)) !== null) {
    if (m.index > last) parts.push({ t: children.slice(last, m.index), b: false });
    parts.push({ t: m[1]!, b: true });
    last = m.index + m[0].length;
  }
  if (last < children.length) parts.push({ t: children.slice(last), b: false });
  return (
    <span>
      {parts.map((p, i) => (p.b ? <strong key={i} style={{ color: T.gold, fontWeight: 700 }}>{p.t}</strong> : <span key={i}>{p.t}</span>))}
    </span>
  );
}

export function TutorialOverlay({ beat, draftedCount = 0, pickedCount = 0, onContinue, onExit }: {
  beat: TutBeat;
  /** How many dice the player has tapped this collect turn (drives the post-collect halo). */
  draftedCount?: number;
  /** How many mash bills the player has selected in the picker (drives the post-pick halo). */
  pickedCount?: number;
  onContinue: () => void;
  onExit: () => void;
}) {
  const ad = beat.spotlightAfterDraft;
  const ap = beat.spotlightAfterPick;
  const target =
    ad && draftedCount >= ad.count ? ad.target
    : ap && pickedCount >= ap.count ? ap.target
    : beat.spotlight;
  const box = useRect(target);
  const PAD = 10;
  const hole = box ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 } : null;
  const isPrompt = !!beat.cta;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none" }}>
      {/* dim + spotlight hole */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="tut-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hole && <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="12" fill="black" style={{ transition: "x .3s ease, y .3s ease, width .3s ease, height .3s ease" }} />}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgb(34,22,11)" fillOpacity="0.72" mask="url(#tut-mask)" />
      </svg>
      {/* amber ring on the target */}
      {hole && (
        <div style={{ position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 12, border: `2px solid ${T.gold}`, boxShadow: `0 0 26px ${T.gold}88, inset 0 0 22px ${T.gold}33`, transition: "top .3s ease, left .3s ease, width .3s ease, height .3s ease", pointerEvents: "none" }} />
      )}

      {/* exit (top-right) */}
      <button onClick={onExit} style={{ position: "absolute", top: 18, right: 22, pointerEvents: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: T.muted, background: "rgba(30,20,11,.9)", border: `1px solid ${T.border}`, padding: "7px 12px", borderRadius: 9, cursor: "pointer" }}>Exit tutorial ✕</button>

      {/* instruction card (bottom-center) */}
      <div style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", width: 600, maxWidth: "92vw", pointerEvents: "auto", borderRadius: 16, border: `1px solid ${T.brass}`, background: "linear-gradient(180deg,#2e2114,#1a1108)", boxShadow: "0 20px 60px rgba(0,0,0,.5)", padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: T.brass }}>Tutorial</span>
          {beat.step != null && <span style={{ fontFamily: MONO, fontSize: 10, color: T.muted }}>step {beat.step} / {TOTAL_STEPS}</span>}
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: T.ink, lineHeight: 1.1 }}>{beat.title}</div>
        <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 8 }}><Rich>{beat.body}</Rich></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          {isPrompt ? (
            <button onClick={onContinue} style={{ padding: "11px 22px", borderRadius: 11, border: 0, cursor: "pointer", fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", color: "#fff7ea", background: "linear-gradient(180deg,#cf8a33,#a3531f)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }}>{beat.cta}</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.gold, animation: "bb-pip 1.4s ease-in-out infinite" }} />
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".04em", color: T.gold }}>{beat.hint ?? "Follow the highlighted step"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
