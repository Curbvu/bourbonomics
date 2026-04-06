import type { GameDoc, Rickhouse } from "./game";
import {
  isBotPlayer,
  buyResources,
  barrelBourbon,
  advancePhase,
  canMash,
  normalizeGame,
} from "./game";

const MAX_BOT_TURN_ITERATIONS = 50;

/**
 * Run the computer player's turn to completion (all phases), then continue
 * if the next player is also a bot, until it's a human's turn or the game ends.
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
      state = { ...state, currentPhase: 2, updatedAt: Date.now() };
      continue;
    }

    if (state.currentPhase === 2) {
      if (state.marketGoods.length > 0) {
        const buyMarket = buyResources(state, "market");
        if (!buyMarket.error) state = buyMarket.game;
      }
      const st = normalizeGame(state);
      const bot = st.players[currentId];
      const nextCost = st.actionsTakenThisTurn ?? 0;
      if (bot && st.resourceDeck.length >= 2 && bot.cash >= nextCost) {
        const buyTwo = buyResources(st, "random");
        if (!buyTwo.error) state = buyTwo.game;
      }
      state = { ...state, currentPhase: 3, updatedAt: Date.now() };
      continue;
    }

    if (state.currentPhase === 3) {
      const bot = state.players[currentId];
      if (bot && canMash(bot.resourceCards)) {
        const rick = pickCheapestRickhouse(state, currentId);
        if (rick) {
          const result = barrelBourbon(state, rick.id, currentId);
          if (!result.error) state = result.game;
        }
      }
      state = { ...state, currentPhase: 4, updatedAt: Date.now() };
      continue;
    }

    if (state.currentPhase === 4) {
      state = advancePhase(state);
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
    const actionCost = game.actionsTakenThisTurn ?? 0;
    if (player && player.cash >= rent + actionCost && rent < bestRent) {
      bestRent = rent;
      best = r;
    }
  }
  return best;
}
