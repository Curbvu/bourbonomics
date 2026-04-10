import type { GameDoc, MarketBuyPicks, Rickhouse } from "./game";
import {
  isBotPlayer,
  buyResources,
  barrelBourbon,
  advancePhase,
  handHasMashForBarrel,
  normalizeGame,
  nextActionCashCost,
  payRickhouseFeesAndAge,
  pickAutoMashIndices,
  rollDemandAndAdvance,
} from "./game";

const MAX_BOT_TURN_ITERATIONS = 80;

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
 * Run the computer baron's turn to completion (all phases), then continue
 * if the next baron is also a bot, until it's a human's turn or the game ends.
 */
export function runComputerTurn(game: GameDoc): GameDoc {
  if (game.status !== "in_progress") return game;
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
      const picks = botMarketPicks(state);
      if (totalMarketCards(state) >= 3) {
        const buyMarket = buyResources(state, picks);
        if (!buyMarket.error) state = buyMarket.game;
      }
      const st = normalizeGame(state);
      const bot = st.players[currentId];
      const nextCost = nextActionCashCost(st.actionsTakenThisTurn ?? 0);
      if (bot && totalMarketCards(st) >= 3 && bot.cash >= nextCost) {
        const buyAgain = buyResources(st, "random");
        if (!buyAgain.error) state = buyAgain.game;
      }
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
      const out = advancePhase(normalizeGame(state));
      state = out.error ? state : out.game;
    }

    iterations++;
  }

  return state;
}

function pickCheapestRickhouse(game: GameDoc, playerId: string): Rickhouse | null {
  let best: Rickhouse | null = null;
  let bestRent = Infinity;
  for (const r of game.rickhouses) {
    if (r.barrels.length >= r.capacity) continue;
    const rent = r.barrels.length + 1;
    const player = game.players[playerId];
    const actionCost = nextActionCashCost(game.actionsTakenThisTurn ?? 0);
    if (player && player.cash >= rent + actionCost && rent < bestRent) {
      bestRent = rent;
      best = r;
    }
  }
  return best;
}
