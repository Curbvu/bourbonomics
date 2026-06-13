"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  applyAction,
  createGame,
  improvementCost,
  matrixValue,
  rankPlayers,
  CONFIG,
  DISTILLERY_ROSTER,
} from "@bourbonomics/prototype-engine";
import type {
  Action,
  Bourbon,
  DepartmentId,
  DieFace,
  GameState,
  Player,
  ResourceCard,
  ResourceKind,
} from "@bourbonomics/prototype-engine";

import ScalingHost from "./components/ScalingHost";

// ── content metadata ─────────────────────────────────────────────────

const PILE_KINDS: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];

const FACE_META: Record<DieFace, { label: string; glyph: string; color: string }> = {
  cask: { label: "Cask", glyph: "🛢", color: "#a07142" },
  corn: { label: "Corn", glyph: "🌽", color: "#d6a94a" },
  rye: { label: "Rye", glyph: "🌾", color: "#c07a3c" },
  wheat: { label: "Wheat", glyph: "🌾", color: "#ccb84e" },
  barley: { label: "Barley", glyph: "🌿", color: "#4f9c87" },
  anything: { label: "Wild", glyph: "⭐", color: "#e8c45e" },
};

const QUALITY_COLOR: Record<string, string> = {
  common: "var(--t-common)",
  specialty: "var(--t-specialty)",
  heritage: "var(--t-heritage)",
};

const DEPT_ORDER: DepartmentId[] = [
  "rickhouse",
  "supply",
  "warehouse",
  "distillingOffice",
  "tastingRoom",
  "marketing",
];

// ── chrome helpers ───────────────────────────────────────────────────

function Panel({
  title,
  accent = "",
  right,
  children,
  className = "",
}: {
  title: string;
  accent?: "market" | "stage" | "hand" | "rivals" | "log" | "";
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bb-panel ${accent ? `bb-panel--${accent}` : ""} flex flex-col overflow-hidden ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--rule)] px-3 py-2">
        <span
          className="font-mono text-[12px] font-semibold uppercase tracking-[.14em]"
          style={{ color: "var(--brass)" }}
        >
          {title}
        </span>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden p-3">{children}</div>
    </section>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  active,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "neutral" | "gold";
  title?: string;
}) {
  const gold = tone === "gold";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "rounded-md border px-3 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.12em] transition",
        disabled
          ? "cursor-not-allowed border-[var(--rule)] text-[var(--mute)] opacity-50"
          : active || gold
            ? "border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] text-[#1a120b]"
            : "border-[var(--rule)] text-[var(--ink)] hover:border-[var(--gold)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── resource / barrel / die tiles ────────────────────────────────────

function ResourceTile({
  card,
  selected,
  onClick,
}: {
  card: ResourceCard;
  selected?: boolean;
  onClick?: () => void;
}) {
  const m = FACE_META[card.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-[88px] shrink-0 flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-center transition",
        selected ? "border-[var(--gold)] bg-[#2a2014]" : "border-[var(--rule)] bg-[var(--panel)]",
        onClick ? "hover:border-[var(--gold)]" : "cursor-default",
      ].join(" ")}
      style={{ borderTopColor: QUALITY_COLOR[card.quality] }}
    >
      <span className="text-[22px] leading-none">{m.glyph}</span>
      <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ink)]">
        {m.label}
      </span>
      <span
        className="font-mono text-[9px] uppercase"
        style={{ color: QUALITY_COLOR[card.quality] }}
      >
        {card.quality}
      </span>
    </button>
  );
}

function BarrelTile({
  b,
  demand,
  bonus,
  selectable,
  selected,
  onClick,
  cta,
}: {
  b: Bourbon;
  demand: number;
  bonus: number;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  cta?: string;
}) {
  const sellable = b.built && b.age >= CONFIG.MIN_SELL_AGE && b.salesRemaining > 0;
  const value = b.built ? matrixValue(b.matrix, b.age, demand) + bonus : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      className={[
        "flex w-[160px] shrink-0 flex-col gap-1 rounded-lg border-2 p-2 text-left transition",
        selected ? "border-[var(--gold)] bg-[#2a2014]" : "border-[var(--rule)] bg-[var(--panel)]",
        selectable ? "hover:border-[var(--gold)]" : "cursor-default",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-display text-[13px] text-[var(--ink)]">{b.name}</span>
        {b.built && (
          <span
            className="rounded px-1 font-mono text-[9px] uppercase"
            style={{ color: QUALITY_COLOR[b.quality] }}
          >
            {b.quality}
          </span>
        )}
      </div>
      {b.built ? (
        <>
          <span className="font-mono text-[11px] text-[var(--brass)]">
            age {b.age} · {b.salesRemaining}/{b.batchQty} sales
          </span>
          <span className="font-mono text-[11px] text-[var(--mute)]">
            {sellable ? `sells for ${value}` : `aging (sell at ${CONFIG.MIN_SELL_AGE}+)`}
          </span>
        </>
      ) : (
        <span className="font-mono text-[11px] text-[var(--mute)]">
          resting · needs {recipeText(b.recipe)}
        </span>
      )}
      {cta && <span className="font-mono text-[10px] uppercase text-[var(--gold)]">{cta}</span>}
    </button>
  );
}

function recipeText(recipe: Partial<Record<ResourceKind, number>>): string {
  const parts: string[] = [];
  for (const k of PILE_KINDS) {
    const n = recipe[k] ?? 0;
    if (n > 0) parts.push(`${n} ${k}`);
  }
  return parts.length ? parts.join(" + ") : "nothing";
}

// ── new-game setup ───────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (names: string[]) => void }) {
  const [count, setCount] = useState(2);
  return (
    <div className="grid h-full place-items-center">
      <div className="flex w-[520px] flex-col gap-5 rounded-2xl border border-[var(--rule)] bg-[var(--panel)] p-8">
        <h1 className="font-display text-[34px] text-[var(--gold)]">Bourbonomics</h1>
        <p className="text-[14px] text-[var(--mute)]">
          A cozy distillery game — Demand, Collect, Play. Gather grain, build and age bourbon,
          and sell into a forecastable market.
        </p>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[12px] uppercase tracking-wide text-[var(--brass)]">
            Players
          </span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Btn key={n} active={count === n} onClick={() => setCount(n)}>
                {n}
              </Btn>
            ))}
          </div>
        </div>
        <Btn
          tone="gold"
          onClick={() => onStart(Array.from({ length: count }, (_, i) => `Player ${i + 1}`))}
        >
          Start Game
        </Btn>
        <p className="font-mono text-[11px] text-[var(--mute)]">
          Distilleries: {DISTILLERY_ROSTER.map((d) => d.name).join(" · ")} (auto-assigned)
        </p>
      </div>
    </div>
  );
}

// ── main client ──────────────────────────────────────────────────────

export default function GameClient() {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Collect-phase selection: dieId → chosen pile (for "anything"); presence = selected.
  const [selDice, setSelDice] = useState<Record<string, ResourceKind | null>>({});
  // Make-phase selection.
  const [selBarrel, setSelBarrel] = useState<string | null>(null);
  const [selCards, setSelCards] = useState<Set<string>>(new Set());
  // Draw-bills keep selection (indexes into the revealed offer).
  const [billsOpen, setBillsOpen] = useState(false);
  const [keep, setKeep] = useState<Set<number>>(new Set());

  function start(names: string[]) {
    setGame(createGame({ seed: (Math.floor(Date.now() / 1000) % 100000) + 1, playerNames: names }));
    resetSel();
  }
  function resetSel() {
    setSelDice({});
    setSelBarrel(null);
    setSelCards(new Set());
    setBillsOpen(false);
    setKeep(new Set());
    setError(null);
  }

  function dispatch(action: Action) {
    if (!game) return;
    const res = applyAction(game, action);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setGame(res.state);
    resetSel();
  }

  if (!game) {
    return (
      <div className="flex h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
        <ScalingHost>
          <SetupScreen onStart={start} />
        </ScalingHost>
      </div>
    );
  }

  const me = game.players[game.currentPlayerIndex]!;
  const ended = game.phase === "ended";
  const ranked = rankPlayers(game);

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <TopBar game={game} onNew={() => setGame(null)} />
      <ScalingHost>
        <div className="flex h-[1080px] w-[1920px] gap-3 p-4">
          {/* LEFT: demand + departments */}
          <div className="flex w-[440px] flex-col gap-3">
            <DemandPanel game={game} />
            <DepartmentsPanel game={game} me={me} dispatch={dispatch} />
          </div>

          {/* CENTER: the active stage */}
          <div className="flex flex-1 flex-col gap-3">
            <Panel
              title={`${stageTitle(game)} — ${me.name}`}
              accent="stage"
              className="flex-1"
              right={
                error ? (
                  <span className="font-mono text-[11px] text-[var(--rose)]">{error}</span>
                ) : null
              }
            >
              {ended ? (
                <EndScreen ranked={ranked} />
              ) : game.roundPhase === "demand" ? (
                <DemandStage dispatch={dispatch} />
              ) : game.roundPhase === "collect" ? (
                <CollectStage
                  game={game}
                  me={me}
                  selDice={selDice}
                  setSelDice={setSelDice}
                  dispatch={dispatch}
                />
              ) : (
                <PlayStage
                  game={game}
                  me={me}
                  dispatch={dispatch}
                  selBarrel={selBarrel}
                  setSelBarrel={setSelBarrel}
                  selCards={selCards}
                  setSelCards={setSelCards}
                  billsOpen={billsOpen}
                  setBillsOpen={setBillsOpen}
                  keep={keep}
                  setKeep={setKeep}
                />
              )}
            </Panel>
            <HandPanel me={me} game={game} />
          </div>

          {/* RIGHT: rivals + log */}
          <div className="flex w-[420px] flex-col gap-3">
            <RivalsPanel game={game} ranked={ranked} />
            <LogPanel game={game} />
          </div>
        </div>
      </ScalingHost>
    </div>
  );
}

function stageTitle(g: GameState): string {
  if (g.phase === "ended") return "Game Over";
  return g.roundPhase === "demand"
    ? "Demand Phase"
    : g.roundPhase === "collect"
      ? "Collect Phase"
      : "Play Phase";
}

// ── top bar (outside the canvas) ─────────────────────────────────────

function TopBar({ game, onNew }: { game: GameState; onNew: () => void }) {
  const me = game.players[game.currentPlayerIndex]!;
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--rule)] bg-[var(--panel)] px-5 py-2">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-[20px] text-[var(--gold)]">Bourbonomics</span>
        <span className="font-mono text-[12px] uppercase tracking-wide text-[var(--brass)]">
          Round {game.roundNumber} · {stageTitle(game)}
          {game.finalRound ? " · FINAL APPROACHING" : ""}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-[12px] text-[var(--ink)]">
          {me.name} · 🪙 {me.capital} · ✦ {me.prestige}
        </span>
        <Link href="/rules" className="font-mono text-[11px] text-[var(--mute)] hover:text-[var(--gold)]">
          Rules
        </Link>
        <Btn onClick={onNew}>New</Btn>
      </div>
    </header>
  );
}

// ── left: demand ─────────────────────────────────────────────────────

function DemandPanel({ game }: { game: GameState }) {
  return (
    <Panel
      title="Market Demand"
      accent="market"
      right={
        <span className="font-mono text-[13px] font-bold text-[var(--gold)]">
          level {game.demand}
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {game.demandCards.map((c) => (
          <div
            key={c.id}
            className="flex w-[120px] flex-col gap-1 rounded-lg border border-[var(--rule)] bg-[var(--panel)] p-2"
          >
            <span className="font-display text-[13px] text-[var(--ink)]">{c.label}</span>
            <span className="font-mono text-[10px] uppercase text-[var(--brass)]">{c.tag}</span>
            <span className="font-mono text-[11px] text-[var(--mute)]">demand {c.level}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] italic text-[var(--mute)]">
        Demand is laid out for the round and holds. Older bourbon × higher demand pays more.
      </p>
    </Panel>
  );
}

// ── left: departments ────────────────────────────────────────────────

function DepartmentsPanel({
  game,
  me,
  dispatch,
}: {
  game: GameState;
  me: Player;
  dispatch: (a: Action) => void;
}) {
  const canImprove = game.roundPhase === "play" && game.phase === "playing";
  const nextCostBase = improvementCost(me.improvements);
  return (
    <Panel
      title="Distillery"
      accent="stage"
      className="flex-1"
      right={
        <span className="font-mono text-[11px] text-[var(--mute)]">
          next improve ≈ {nextCostBase}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        {DEPT_ORDER.map((id) => {
          const d = me.distillery.departments.find((x) => x.id === id)!;
          const maxed = d.level >= d.maxLevel;
          const cost = improvementCost(me.improvements, d.discount);
          const nextVal = maxed ? d.values[d.level] : d.values[d.level + 1];
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--rule)] bg-[var(--panel)] px-2 py-1.5"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[13px] text-[var(--ink)]">{d.name}</span>
                  <span className="font-mono text-[11px] text-[var(--gold)]">
                    {d.values[d.level]}
                    {!maxed && <span className="text-[var(--mute)]"> → {nextVal}</span>}
                  </span>
                  {d.discount > 0 && (
                    <span className="font-mono text-[9px] text-[var(--emerald)]">−{d.discount}</span>
                  )}
                </div>
                <span className="font-mono text-[9px] text-[var(--mute)]">{d.blurb}</span>
              </div>
              <Btn
                onClick={() => dispatch({ type: "IMPROVE", departmentId: id })}
                disabled={!canImprove || maxed || me.capital < cost}
                title={maxed ? "fully grown" : `costs ${cost} capital`}
              >
                {maxed ? "max" : `+${cost}`}
              </Btn>
            </div>
          );
        })}
      </div>
      <div className="mt-2 font-mono text-[10px] text-[var(--mute)]">
        L{me.distillery.distilleryId} · {me.distillery.signatureBlurb}
      </div>
    </Panel>
  );
}

// ── center stages ────────────────────────────────────────────────────

function DemandStage({ dispatch }: { dispatch: (a: Action) => void }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="max-w-[420px] text-[15px] text-[var(--mute)]">
          The round&apos;s demand is on the table (left). When everyone has read it, begin the
          Collect Phase — roll resource dice, most-Capital-first.
        </p>
        <Btn tone="gold" onClick={() => dispatch({ type: "BEGIN_COLLECT" })}>
          Begin Collect Phase
        </Btn>
      </div>
    </div>
  );
}

function CollectStage({
  game,
  me,
  selDice,
  setSelDice,
  dispatch,
}: {
  game: GameState;
  me: Player;
  selDice: Record<string, ResourceKind | null>;
  setSelDice: (v: Record<string, ResourceKind | null>) => void;
  dispatch: (a: Action) => void;
}) {
  const c = game.collect!;
  const warehouseCap = me.distillery.departments.find((d) => d.id === "warehouse")!.values[
    me.distillery.departments.find((d) => d.id === "warehouse")!.level
  ]!;
  const room = warehouseCap - me.hand.length;
  const selectedIds = Object.keys(selDice);

  function toggle(dieId: string, face: DieFace) {
    const next = { ...selDice };
    if (dieId in next) {
      delete next[dieId];
    } else {
      next[dieId] = face === "anything" ? null : (face as ResourceKind);
    }
    setSelDice(next);
  }
  function setPile(dieId: string, pile: ResourceKind) {
    setSelDice({ ...selDice, [dieId]: pile });
  }

  const claimsReady = selectedIds.every((id) => {
    const die = c.dice.find((d) => d.id === id)!;
    return die.face !== "anything" || selDice[id] != null;
  });
  const claims = selectedIds.map((id) => {
    const die = c.dice.find((d) => d.id === id)!;
    return die.face === "anything"
      ? { dieId: id, pile: selDice[id] as ResourceKind }
      : { dieId: id };
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] text-[var(--brass)]">
          Rerolls {c.rerollsUsed}/{c.maxRerolls} · Warehouse room {Math.max(0, room)}
        </span>
        <span className="font-mono text-[11px] text-[var(--mute)]">
          Pass order: {c.order.map((i) => game.players[i]!.name).join(" → ")}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {c.dice.map((d) => {
          const m = FACE_META[d.face];
          const sel = d.id in selDice;
          return (
            <div key={d.id} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(d.id, d.face)}
                className={[
                  "grid h-[72px] w-[72px] place-items-center rounded-xl border-2 text-[30px] transition",
                  sel ? "border-[var(--gold)] bg-[#2a2014]" : "border-[var(--rule)] bg-[var(--panel)]",
                ].join(" ")}
                style={{ color: m.color }}
                title={m.label}
              >
                {m.glyph}
              </button>
              {sel && d.face === "anything" && (
                <select
                  value={selDice[d.id] ?? ""}
                  onChange={(e) => setPile(d.id, e.target.value as ResourceKind)}
                  className="rounded border border-[var(--rule)] bg-[var(--panel)] px-1 py-0.5 font-mono text-[10px] text-[var(--ink)]"
                >
                  <option value="" disabled>
                    pile…
                  </option>
                  {PILE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Btn
          onClick={() => dispatch({ type: "COLLECT_REROLL", diceIds: selectedIds })}
          disabled={selectedIds.length === 0 || c.rerollsUsed >= c.maxRerolls}
        >
          Reroll selected
        </Btn>
        <Btn
          tone="gold"
          onClick={() => dispatch({ type: "COLLECT_CLAIM", claims })}
          disabled={selectedIds.length === 0 || !claimsReady || selectedIds.length > Math.max(0, room)}
          title={selectedIds.length > room ? "exceeds Warehouse room" : ""}
        >
          Claim {selectedIds.length} → resources
        </Btn>
        <Btn onClick={() => dispatch({ type: "COLLECT_CLAIM", claims: [] })}>
          Claim none / pass
        </Btn>
      </div>
      <p className="font-mono text-[10px] italic text-[var(--mute)]">
        Unclaimed dice pass to the next player as inheritance.
      </p>
    </div>
  );
}

function PlayStage({
  game,
  me,
  dispatch,
  selBarrel,
  setSelBarrel,
  selCards,
  setSelCards,
  billsOpen,
  setBillsOpen,
  keep,
  setKeep,
}: {
  game: GameState;
  me: Player;
  dispatch: (a: Action) => void;
  selBarrel: string | null;
  setSelBarrel: (v: string | null) => void;
  selCards: Set<string>;
  setSelCards: (v: Set<string>) => void;
  billsOpen: boolean;
  setBillsOpen: (v: boolean) => void;
  keep: Set<number>;
  setKeep: (v: Set<number>) => void;
}) {
  const depts = me.distillery.departments;
  const dv = (id: DepartmentId) => {
    const d = depts.find((x) => x.id === id)!;
    return d.values[d.level]!;
  };
  const rickCap = dv("rickhouse");
  const office = dv("distillingOffice");
  const tasting = dv("tastingRoom");
  const offer = game.mashBillSupply.slice(0, Math.min(office, game.mashBillSupply.length));
  const room = rickCap - me.rickhouse.length;

  // Make: which cards satisfy the selected barrel's recipe?
  const barrel = me.rickhouse.find((b) => b.id === selBarrel && !b.built) ?? null;
  const have = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of selCards) {
      const card = me.hand.find((c) => c.id === id);
      if (card) counts[card.kind] = (counts[card.kind] ?? 0) + 1;
    }
    return counts;
  }, [selCards, me.hand]);
  const recipeOk =
    barrel != null &&
    PILE_KINDS.every((k) => (have[k] ?? 0) === (barrel.recipe[k] ?? 0));

  function toggleCard(id: string) {
    const next = new Set(selCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelCards(next);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Btn
          onClick={() => setBillsOpen(!billsOpen)}
          disabled={me.drewMashBillsThisTurn || offer.length === 0 || room <= 0}
          active={billsOpen}
          title={me.drewMashBillsThisTurn ? "already drawn this turn" : `reveal ${office} bills`}
        >
          Draw Mash Bills
        </Btn>
        <Btn
          tone="gold"
          onClick={() =>
            dispatch({
              type: "MAKE_BOURBON",
              barrelId: selBarrel!,
              resourceCardIds: [...selCards],
            })
          }
          disabled={!recipeOk}
          title={barrel ? "commit selected cards" : "pick a resting barrel below"}
        >
          Make Bourbon
        </Btn>
        <span className="ml-auto font-mono text-[11px] text-[var(--mute)]">
          Rickhouse {me.rickhouse.length}/{rickCap} · Tasting +{tasting}/sale
        </span>
        <Btn onClick={() => dispatch({ type: "END_TURN" })}>End Turn</Btn>
      </div>

      {/* draw-bills keep selector */}
      {billsOpen && (
        <div className="rounded-lg border border-[var(--gold)] bg-[#241b10] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[12px] uppercase tracking-wide text-[var(--brass)]">
              Keep up to {Math.max(0, room)} (rejected cycle back)
            </span>
            <Btn
              tone="gold"
              onClick={() => dispatch({ type: "DRAW_MASH_BILLS", keepIndexes: [...keep] })}
              disabled={keep.size > room}
            >
              Confirm
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            {offer.map((bill, i) => {
              const sel = keep.has(i);
              return (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(keep);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    setKeep(next);
                  }}
                  className={[
                    "flex w-[150px] flex-col gap-0.5 rounded-md border-2 p-2 text-left transition",
                    sel
                      ? "border-[var(--gold)] bg-[#2a2014]"
                      : "border-[var(--rule)] bg-[var(--panel)]",
                  ].join(" ")}
                >
                  <span className="font-display text-[13px] text-[var(--ink)]">{bill.name}</span>
                  <span className="font-mono text-[10px] text-[var(--brass)]">
                    {bill.expression} · {bill.batchQty} sales
                  </span>
                  <span className="font-mono text-[10px] text-[var(--mute)]">
                    {recipeText(bill.recipe)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* rickhouse */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-[var(--brass)]">
          Rickhouse
          {barrel && (
            <span className="ml-2 text-[var(--gold)]">
              making “{barrel.name}” — need {recipeText(barrel.recipe)}; pick cards below
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 overflow-y-auto" style={{ maxHeight: 360 }}>
          {me.rickhouse.length === 0 && (
            <p className="text-[13px] italic text-[var(--mute)]">
              Empty — Draw Mash Bills to lay down a resting barrel.
            </p>
          )}
          {me.rickhouse.map((b) => {
            const sellable = b.built && b.age >= CONFIG.MIN_SELL_AGE && b.salesRemaining > 0;
            return (
              <BarrelTile
                key={b.id}
                b={b}
                demand={game.demand}
                bonus={tasting}
                selectable={!b.built || sellable}
                selected={selBarrel === b.id}
                onClick={() => {
                  if (!b.built) {
                    setSelBarrel(selBarrel === b.id ? null : b.id);
                    setSelCards(new Set());
                  } else if (sellable) {
                    dispatch({ type: "SELL", bourbonId: b.id });
                  }
                }}
                cta={!b.built ? "tap to build" : sellable ? "tap to sell" : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* hand selection for make */}
      {barrel && (
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-[var(--brass)]">
            Commit cards {recipeOk ? "✓" : "(must match exactly)"}
          </div>
          <div className="flex flex-wrap gap-2">
            {me.hand.map((card) => (
              <ResourceTile
                key={card.id}
                card={card}
                selected={selCards.has(card.id)}
                onClick={() => toggleCard(card.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── bottom: hand ─────────────────────────────────────────────────────

function HandPanel({ me, game }: { me: Player; game: GameState }) {
  const wh = me.distillery.departments.find((d) => d.id === "warehouse")!;
  const cap = wh.values[wh.level]!;
  return (
    <Panel
      title="Warehouse (hand)"
      accent="hand"
      className="h-[210px]"
      right={
        <span
          className={`font-mono text-[12px] ${me.hand.length >= cap ? "text-[var(--rose)]" : "text-[var(--mute)]"}`}
        >
          {me.hand.length}/{cap}
        </span>
      }
    >
      {me.hand.length === 0 ? (
        <p className="text-[13px] italic text-[var(--mute)]">
          {game.roundPhase === "collect"
            ? "Claim dice to draw resources."
            : "No resources held."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 overflow-y-auto" style={{ maxHeight: 150 }}>
          {me.hand.map((card) => (
            <ResourceTile key={card.id} card={card} />
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── right: rivals + log ──────────────────────────────────────────────

function RivalsPanel({
  game,
  ranked,
}: {
  game: GameState;
  ranked: ReturnType<typeof rankPlayers>;
}) {
  return (
    <Panel title="Distilleries" accent="rivals" className="flex-1">
      <div className="flex flex-col gap-2">
        {game.players.map((p, i) => {
          const score = ranked.find((r) => r.playerId === p.id)!;
          const isCurrent = i === game.currentPlayerIndex;
          return (
            <div
              key={p.id}
              className={[
                "rounded-md border px-3 py-2",
                isCurrent ? "border-[var(--gold)] bg-[#241b10]" : "border-[var(--rule)] bg-[var(--panel)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[14px] text-[var(--ink)]">
                  {p.name}
                  {isCurrent && <span className="ml-2 text-[var(--gold)]">●</span>}
                </span>
                <span className="font-mono text-[12px] text-[var(--gold)]">{score.total} pts</span>
              </div>
              <div className="font-mono text-[10px] text-[var(--mute)]">
                🪙 {p.capital} · ✦ {p.prestige} · 🛢 {p.rickhouse.length} · sold {p.bourbonsSold}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function LogPanel({ game }: { game: GameState }) {
  const recent = game.log.slice(-40).reverse();
  return (
    <Panel title="Log" accent="log" className="h-[300px]">
      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 240 }}>
        {recent.map((line, i) => (
          <p key={i} className="font-mono text-[11px] leading-snug text-[var(--mute)]">
            {line}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function EndScreen({ ranked }: { ranked: ReturnType<typeof rankPlayers> }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-4">
        <h2 className="font-display text-[30px] text-[var(--gold)]">Game Over</h2>
        <div className="flex flex-col gap-2">
          {ranked.map((r, i) => (
            <div
              key={r.playerId}
              className="flex w-[360px] items-center justify-between rounded-md border border-[var(--rule)] bg-[var(--panel)] px-4 py-2"
            >
              <span className="font-display text-[16px] text-[var(--ink)]">
                {i + 1}. {r.name}
              </span>
              <span className="font-mono text-[14px] text-[var(--gold)]">
                {r.total} ({r.capital} + {r.prestigeAsCapital})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
