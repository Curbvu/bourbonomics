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
import { batchQtyForRecipe, createGame, saleBonusForRecipe } from "@bourbonomics/prototype-engine";
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
const T = { ink: "#f0e3c8", text2: "#b9a684", muted: "#7c6a51", gold: "#f0c970", brass: "#c69d52", border: "#3b2818", green: "#6db28c" };

// ── rigging helpers (deterministic scenario) ─────────────────────────
function res(kind: ResourceKind, i: number): ResourceCard {
  const names: Record<ResourceKind, string> = {
    cask: "New-Char Cask", corn: "Corn", rye: "Rye", wheat: "Wheat", barley: "Barley",
  };
  return { id: `tut_${kind}_${i}`, defId: `res_${kind}_common`, kind, quality: "common", name: names[kind], placeholder: true };
}

function singleBarrelBill(i: number): MashBill {
  const recipe: Partial<Record<ResourceKind, number>> = { cask: 1, corn: 1 };
  return {
    id: `tut_sb_${i}`, defId: "mb_single_barrel", name: "Single Barrel Select",
    traits: ["clean"], expression: "bourbon", styleTag: "classic",
    recipe, batchQty: batchQtyForRecipe(recipe), saleBonus: saleBonusForRecipe(recipe), placeholder: true,
  };
}

function houseOrder(): DemandCard {
  return {
    id: "tut_order", defId: "dm_house", label: "House Pour", requirement: {},
    slotMultiple: 1, slotsActive: 1, filledBy: [null],
    zoneBonus: { low: 2, mid: 3, high: 4 }, reputation: 3, placeholder: true,
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
  /** Step counter shown on the card. */
  step?: number;
}

const TOTAL_STEPS = 6;

export const TUT_BEATS: TutBeat[] = [
  {
    id: "welcome",
    title: "Welcome to Bourbonomics",
    body: "You run a bourbon distillery. Every round you read **demand**, gather **grain**, age **bourbon**, and sell it into **orders**. Let's walk one round together.",
    cta: "Begin",
  },
  {
    id: "market",
    title: "The demand market",
    body: "Orders stack here from the floor up — the higher the pile, the **hotter the zone** and the more each sale pays. Fill an order's slots to **complete** it and keep it as **Reputation**. We've lined up one simple order: a House Pour.",
    spotlight: "market",
    cta: "Got it",
    onEnter: (g) => ({ ...structuredClone(g), demandCards: [houseOrder()] }),
  },
  {
    id: "begin",
    title: "Open the dice draft",
    body: "Each round opens with Demand, then the **Collect** dice draft. Press **Begin draft** to roll your Supply dice.",
    spotlight: "begin",
    hint: "Press Begin draft to roll.",
    step: 1,
    allow: (a) => a.type === "BEGIN_COLLECT",
    goal: (a) => a.type === "BEGIN_COLLECT",
  },
  {
    id: "draft",
    title: "Draft your grain",
    body: "Each die is a resource — **cask, corn, rye, wheat, barley**, or a wild ✦. To brew you need a **cask and a corn**. Tap two dice, then press **Draft & pass on**.",
    spotlight: "dice",
    hint: "Tap at least two dice, then Draft & pass on.",
    step: 2,
    // dice rolled on BEGIN_COLLECT — rig the faces so cask + corn are present
    onEnter: (g) => {
      const d = structuredClone(g);
      const faces: ResourceKind[] = ["cask", "corn", "corn", "rye", "wheat"];
      if (d.collect) d.collect.dice = d.collect.dice.map((die, i) => ({ ...die, face: faces[i] ?? "corn" }));
      return d;
    },
    allow: (a) => (a.type === "COLLECT_CLAIM" ? a.claims.length >= 2 : a.type === "COLLECT_REROLL"),
    goal: (a) => a.type === "COLLECT_CLAIM",
  },
  {
    id: "draw",
    title: "Draw a recipe",
    body: "The **Play** phase is where you brew. **Draw Mash Bills** to get a recipe — we've stocked a simple one: **Single Barrel Select** (1 cask + 1 corn). Draw, keep it, and confirm.",
    spotlight: "draw",
    hint: "Draw Mash Bills, then Keep the recipe.",
    step: 3,
    // guarantee a buildable hand + a simple bill offer
    onEnter: (g) => {
      const d = structuredClone(g);
      d.players[0]!.hand = [res("cask", 1), res("corn", 1)];
      d.mashBillSupply = [singleBarrelBill(0), singleBarrelBill(1), singleBarrelBill(2), ...d.mashBillSupply];
      d.players[0]!.drewMashBillsThisTurn = false;
      return d;
    },
    allow: (a) => a.type === "DRAW_MASH_BILLS" && a.keepIndexes.length >= 1,
    goal: (a) => a.type === "DRAW_MASH_BILLS",
  },
  {
    id: "stage",
    title: "Stage your grain",
    body: "Move your **cask** and **corn** onto the recipe. Staged cards lock to the barrel and free Warehouse space. Use **Stage** until the recipe is full.",
    spotlight: "resting",
    hint: "Stage the cask, then the corn.",
    step: 4,
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
    step: 5,
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
    body: "Your bourbon is ready. **Tap the barrel**, then route it to the **House Pour** order. Every sale banks **Capital** — and filling the order's last slot **completes** it for **Reputation**.",
    spotlight: "aging",
    hint: "Tap the aged barrel, then pick the House Pour order.",
    step: 6,
    allow: (a) => a.type === "SELL",
    goal: (a) => a.type === "SELL",
  },
  {
    id: "done",
    title: "That's the loop!",
    body: "**Demand → Collect → Play → age → repeat** until the demand deck runs dry. You bank **Capital** from every sale and **Reputation** from finishing orders — most points wins. Grow your seven departments to draw harder, hold more, and sell richer. Now play a full game!",
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

export function TutorialOverlay({ beat, onContinue, onExit }: {
  beat: TutBeat;
  onContinue: () => void;
  onExit: () => void;
}) {
  const box = useRect(beat.spotlight);
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
        <rect x="0" y="0" width="100%" height="100%" fill="rgb(8,5,3)" fillOpacity="0.8" mask="url(#tut-mask)" />
      </svg>
      {/* amber ring on the target */}
      {hole && (
        <div style={{ position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 12, border: `2px solid ${T.gold}`, boxShadow: `0 0 26px ${T.gold}88, inset 0 0 22px ${T.gold}33`, transition: "top .3s ease, left .3s ease, width .3s ease, height .3s ease", pointerEvents: "none" }} />
      )}

      {/* exit (top-right) */}
      <button onClick={onExit} style={{ position: "absolute", top: 18, right: 22, pointerEvents: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: T.muted, background: "rgba(20,14,8,.9)", border: `1px solid ${T.border}`, padding: "7px 12px", borderRadius: 9, cursor: "pointer" }}>Exit tutorial ✕</button>

      {/* instruction card (bottom-center) */}
      <div style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", width: 600, maxWidth: "92vw", pointerEvents: "auto", borderRadius: 16, border: `1px solid ${T.brass}`, background: "linear-gradient(180deg,#221710,#140d07)", boxShadow: "0 20px 60px rgba(0,0,0,.6)", padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: T.brass }}>Tutorial</span>
          {beat.step != null && <span style={{ fontFamily: MONO, fontSize: 10, color: T.muted }}>step {beat.step} / {TOTAL_STEPS}</span>}
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: T.ink, lineHeight: 1.1 }}>{beat.title}</div>
        <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 8 }}><Rich>{beat.body}</Rich></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          {isPrompt ? (
            <button onClick={onContinue} style={{ padding: "11px 22px", borderRadius: 11, border: 0, cursor: "pointer", fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", color: "#2a1408", background: "linear-gradient(180deg,#e9b46e,#c69d52)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>{beat.cta}</button>
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
