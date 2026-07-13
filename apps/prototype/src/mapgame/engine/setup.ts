// Bourbonomics: Map Game — game setup.
//
// Builds a fresh GameState from a seed + player names. Deterministic: a given
// (seed, names) pair always yields the same board and opening hands. The game
// opens in age 1, round 1, stage "choose".

import { CONFIG } from "./config";
import { buildDistillDeck, buildHand } from "./content";
import { controlledTiles } from "./derive";
import { hexSpiral } from "./hex";
import { nextId } from "./ids";
import { rngRange, shuffle } from "./rng";
import { TASTE_TRAITS } from "./types";
import type { DistillSlot, DP, GameState, Player, Tile } from "./types";

export interface NewMapGameOptions {
  seed?: number;
  playerNames?: string[];
  botFlags?: boolean[];
}

function makePlayer(id: string, name: string, isBot: boolean, colorIdx: number, age: number): Player {
  return {
    id,
    name,
    isBot,
    colorIdx,
    capital: CONFIG.STARTING_CAPITAL,
    tokens: CONFIG.STARTING_TOKENS,
    agents: CONFIG.STARTING_AGENTS,
    hand: buildHand(id, age),
    cellar: [],
    playedCard: null,
    sacrificed: false,
    bips: 0,
    hasChosen: false,
    done: false,
  };
}

function buildTiles(count: number, seed: number): [Tile[], number] {
  const hexes = hexSpiral(count);
  const tiles: Tile[] = [];
  let s = seed;
  for (let i = 0; i < hexes.length; i++) {
    // 1–2 liked traits
    const [nTraits, s1] = rngRange(s, 2);
    s = s1;
    const traits = new Set<Tile["traits"][number]>();
    const wanted = 1 + nTraits; // 1 or 2
    while (traits.size < wanted) {
      const [ti, sn] = rngRange(s, TASTE_TRAITS.length);
      s = sn;
      traits.add(TASTE_TRAITS[ti]!);
    }
    // ~30% carry an averse trait (not among liked)
    const [aRoll, s2] = rngRange(s, 100);
    s = s2;
    let averse: Tile["averse"] = null;
    if (aRoll < 30) {
      const options = TASTE_TRAITS.filter((t) => !traits.has(t));
      const [ai, s3] = rngRange(s, options.length);
      s = s3;
      averse = options[ai]!;
    }
    // reward icon
    const [rRoll, s4] = rngRange(s, 100);
    s = s4;
    let reward: Tile["reward"] = null;
    if (rRoll < CONFIG.REWARD_DENSITY * 100) {
      const [cap, s5] = rngRange(s, 2);
      s = s5;
      reward = cap === 0 ? "capital" : "token";
    }
    // shelf capacity
    const [shelfR, s6] = rngRange(s, CONFIG.SHELF_MAX - CONFIG.SHELF_MIN + 1);
    s = s6;
    const shelfCapacity = CONFIG.SHELF_MIN + shelfR;

    tiles.push({
      id: `tile_${i}`,
      hex: hexes[i]!,
      traits: [...traits],
      averse,
      reward,
      shelfCapacity,
    });
  }
  return [tiles, s];
}

export function createMapGame(options: NewMapGameOptions = {}): GameState {
  const seed = (options.seed ?? 1) | 0;
  const names = options.playerNames?.length ? options.playerNames : ["You", "Rival"];
  let s = seed;

  const players = names.map((name, i) =>
    makePlayer(`p${i + 1}`, name, options.botFlags?.[i] ?? i !== 0, i, 1),
  );

  const tileCount = CONFIG.TILES_PER_PLAYER * players.length;
  const [tiles, s1] = buildTiles(tileCount, s);
  s = s1;

  // Starting DPs — spread each player across distinct tiles so nobody is boxed in.
  const dps: DP[] = [];
  for (let p = 0; p < players.length; p++) {
    for (let k = 0; k < CONFIG.STARTING_DPS; k++) {
      const tileIdx = (p + k * players.length) % tiles.length;
      dps.push({
        id: nextId("dp"),
        owner: players[p]!.id,
        tileId: tiles[tileIdx]!.id,
        status: "active",
      });
    }
  }

  // Distill row — shuffle the deck, deal the opening row.
  const [deck, s2] = shuffle(buildDistillDeck(), s);
  s = s2;
  const distillRow: DistillSlot[] = [];
  for (let i = 0; i < CONFIG.DISTILL_ROW && deck.length; i++) {
    distillRow.push({ def: deck.shift()!, agents: {} });
  }

  const state: GameState = {
    phase: "playing",
    age: 1,
    round: 1,
    stage: "choose",
    players,
    tiles,
    dps,
    niches: [],
    distillRow,
    distillDeck: deck,
    turnOrder: players.map((_, i) => i), // round-1 choose order = seat order
    turnPos: 0,
    startPlayerIndex: 0,
    rngSeed: s,
    log: [
      `Map Game created (seed ${seed}, ${players.length} player(s), ${tiles.length} tiles).`,
      `— Age 1, Round 1 — choose an action card.`,
    ],
  };

  // Opening (age-1) income from controlled tiles, so the first age isn't
  // starved. Ages 2+ get the same grant from the engine's age-start hook.
  for (const p of state.players) {
    const income = controlledTiles(state, p.id).length * CONFIG.TILE_CAPITAL_INCOME;
    if (income > 0) {
      p.capital += income;
      state.log.push(`${p.name} banks ${income} opening Capital from controlled tiles.`);
    }
  }
  return state;
}
