import type { GameDoc, MarketBuyPicks, Rickhouse } from "./game";
import {
  applyDemandRoll,
  isBotPlayer,
  buyResources,
  barrelBourbon,
  advancePhase,
  handHasMashForBarrel,
  normalizeGame,
  nextActionCashCostFromGame,
  passActionPhase,
  payRickhouseFeesAndAge,
  pickAutoMashIndices,
  previewRickhouseFeesForPlayer,
  previewSaleProceeds,
  rollDemandAndAdvance,
  sellBourbon,
  usesTableRoundStructure,
} from "./game";

const MAX_BOT_TURN_ITERATIONS = 120;
/** Extra cash the bot tries to keep above next Phase 1 rickhouse fees. */
const BOT_RENT_BUFFER = 2;
const MAX_BOT_SELLS_PER_PHASE = 24;

function totalMarketCards(g: GameDoc): number {
  const p = g.marketPiles;
  if (!p) return 0;
  return p.cask.length + p.corn.length + p.grain.length;
}

function botMarketPicks(g: GameDoc): MarketBuyPicks | "random" {
  const p = g.marketPiles;
  if (!p) return "random";
  if (p.cask.length >= 1 && p.corn.length >= 1 && p.grain.length >= 1)
    return { cask: 1, corn: 1, grain: 1 };
  return "random";
}

/**
 * Sell oldest eligible barrels (age ≥ 2) until cash covers upcoming rickhouse fees
 * (preview) plus a small buffer, or nothing left to sell / can’t afford the sell action.
 */
function sellBarrelsForRentIfNeeded(game: GameDoc, playerId: string): GameDoc {
  let state = game;
  for (let n = 0; n < MAX_BOT_SELLS_PER_PHASE; n++) {
    const player = state.players[playerId];
    if (!player) break;
    const rentNeed = previewRickhouseFeesForPlayer(state, playerId);
    const sellActionCost = nextActionCashCostFromGame(state);
    if (player.cash >= rentNeed + BOT_RENT_BUFFER) break;

    const sellable = player.barrelledBourbons.filter((b) => b.age >= 2);
    if (!sellable.length) break;
    if (player.cash < sellActionCost) break;

    const ranked = [...sellable].sort(
      (a, b) => previewSaleProceeds(state, b.age) - previewSaleProceeds(state, a.age)
    );
    const barrel = ranked[0]!;
    const out = sellBourbon(state, playerId, barrel.id);
    if (out.error) break;
    state = out.game;
  }
  return state;
}

function pickCheapestRickhouse(game: GameDoc, playerId: string): Rickhouse | null {
  let best: Rickhouse | null = null;
  let bestOccupancy = Infinity;
  for (const r of game.rickhouses) {
    if (r.barrels.length >= r.capacity) continue;
    const player = game.players[playerId];
    const actionCost = nextActionCashCostFromGame(game);
    if (player && player.cash >= actionCost && r.barrels.length < bestOccupancy) {
      bestOccupancy = r.barrels.length;
      best = r;
    }
  }
  return best;
}

function runComputerTurnTableRounds(game: GameDoc): GameDoc {
  let state = normalizeGame({ ...game });
  let iterations = 0;

  while (iterations < MAX_BOT_TURN_ITERATIONS) {
    const currentId = state.playerOrder[state.currentPlayerIndex];
    if (!currentId || !isBotPlayer(currentId)) break;
    if (state.status === "finished") break;

    const player = state.players[currentId];
    if (!player) break;

    if (state.currentPhase === 1) {
      if (state.roundNumber <= 1) {
        state = normalizeGame({
          ...state,
          currentPhase: 2,
          feesPaidPlayerIds: [],
          updatedAt: Date.now(),
        });
        continue;
      }
      const res = payRickhouseFeesAndAge(state, currentId);
      if (!res.error) {
        state = res.game;
      }
      continue;
    }

    if (state.currentPhase === 2) {
      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const picks = botMarketPicks(state);
      if (totalMarketCards(state) >= 3) {
        const buyMarket = buyResources(state, picks);
        if (!buyMarket.error) {
          state = buyMarket.game;
          iterations++;
          continue;
        }
      }

      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const st = normalizeGame(state);
      const bot = st.players[currentId];
      const nextCost = nextActionCashCostFromGame(st);
      const rentAfterFirstBuy = previewRickhouseFeesForPlayer(st, currentId);
      if (
        bot &&
        totalMarketCards(st) >= 3 &&
        bot.cash >= nextCost + rentAfterFirstBuy + BOT_RENT_BUFFER
      ) {
        const buyAgain = buyResources(st, "random");
        if (!buyAgain.error) {
          state = buyAgain.game;
          iterations++;
          continue;
        }
      }

      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const st2 = normalizeGame(state);
      const bot2 = st2.players[currentId];
      if (bot2 && handHasMashForBarrel(bot2.resourceCards)) {
        const rick = pickCheapestRickhouse(st2, currentId);
        const autoIdx = pickAutoMashIndices(bot2.resourceCards);
        if (rick && autoIdx?.length) {
          const result = barrelBourbon(st2, rick.id, currentId, autoIdx);
          if (!result.error) {
            state = result.game;
            iterations++;
            continue;
          }
        }
      }

      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const pass = passActionPhase(normalizeGame(state), currentId);
      state = pass.error ? state : pass.game;
      iterations++;
      continue;
    }

    if (state.currentPhase === 3) {
      const rolled = applyDemandRoll(state, currentId);
      state = rolled.error ? state : rolled.game;
      iterations++;
      continue;
    }

    iterations++;
  }

  return state;
}

/**
 * Run the computer baron’s opportunities to completion (table rounds or legacy turn),
 * then continue if the next seat is also a bot.
 */
export function runComputerTurn(game: GameDoc): GameDoc {
  if (game.status !== "in_progress") return game;
  if (usesTableRoundStructure(game)) {
    return runComputerTurnTableRounds(game);
  }

  let state = normalizeGame({ ...game });
  let iterations = 0;

  while (iterations < MAX_BOT_TURN_ITERATIONS) {
    const currentId = state.playerOrder[state.currentPlayerIndex];
    if (!currentId || !isBotPlayer(currentId)) break;
    if (state.status === "finished") break;

    const player = state.players[currentId];
    if (!player) break;

    if (state.currentPhase === 1) {
      const res = payRickhouseFeesAndAge(state, currentId);
      if (!res.error) {
        state = res.game;
      } else {
        state = {
          ...state,
          rickhouseFeesPaidThisTurn: true,
          updatedAt: Date.now(),
        };
      }
      const adv = advancePhase(state);
      state = adv.error ? state : adv.game;
      continue;
    }

    if (state.currentPhase === 2) {
      const rolled = rollDemandAndAdvance(state, currentId);
      state = rolled.error ? state : rolled.game;
      continue;
    }

    if (state.currentPhase === 3) {
      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const picks = botMarketPicks(state);
      if (totalMarketCards(state) >= 3) {
        const buyMarket = buyResources(state, picks);
        if (!buyMarket.error) state = buyMarket.game;
      }
      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const st = normalizeGame(state);
      const bot = st.players[currentId];
      const nextCost = nextActionCashCostFromGame(st);
      const rentAfterFirstBuy = previewRickhouseFeesForPlayer(st, currentId);
      if (
        bot &&
        totalMarketCards(st) >= 3 &&
        bot.cash >= nextCost + rentAfterFirstBuy + BOT_RENT_BUFFER
      ) {
        const buyAgain = buyResources(st, "random");
        if (!buyAgain.error) state = buyAgain.game;
      }
      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const st2 = normalizeGame(state);
      const bot2 = st2.players[currentId];
      if (bot2 && handHasMashForBarrel(bot2.resourceCards)) {
        const rick = pickCheapestRickhouse(st2, currentId);
        const autoIdx = pickAutoMashIndices(bot2.resourceCards);
        if (rick && autoIdx?.length) {
          const result = barrelBourbon(st2, rick.id, currentId, autoIdx);
          if (!result.error) state = result.game;
        }
      }
      state = sellBarrelsForRentIfNeeded(normalizeGame(state), currentId);

      const out = advancePhase(normalizeGame(state));
      state = out.error ? state : out.game;
    }

    iterations++;
  }

  return state;
}
