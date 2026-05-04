"use client";

import type { GameState } from "@bourbonomics/engine";
import { colorFor } from "@/lib/colors";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function roman(n: number): string {
  return ROMAN[n] ?? `${n}`;
}

export function Header({
  state,
  onQuit,
}: {
  state: GameState;
  onQuit: () => void;
}) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/90 backdrop-blur px-6 py-3 flex items-center gap-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded border border-amber-600/60 bg-amber-900/20 flex items-center justify-center text-amber-500 font-bold text-lg">
          B
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">Bourbonomics</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Distillery
          </div>
        </div>
      </div>

      {/* Year */}
      <div className="flex items-center gap-3 pl-6 border-l border-neutral-800">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Year
        </span>
        <span className="text-2xl font-semibold text-amber-500 tabular-nums tracking-wider">
          {roman(state.round)}
        </span>
      </div>

      {/* Player chips — centered */}
      <div className="flex-1 flex items-center justify-center gap-3">
        {state.players.map((p, i) => {
          const color = colorFor(i);
          const isCurrent =
            state.phase === "action" && i === state.currentPlayerIndex;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded border px-3 py-1.5 transition ${
                isCurrent
                  ? `${color.avatarBorder} bg-neutral-900 ring-2 ${color.ring}/40`
                  : "border-neutral-800 bg-neutral-900/60"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full ${color.avatarBg} flex items-center justify-center text-xs font-bold text-white`}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-amber-400 font-semibold tabular-nums">
                {p.reputation}
                <span className="text-[10px] text-neutral-500 ml-0.5">rep</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Quit */}
      <button
        onClick={onQuit}
        className="text-xs px-3 py-1.5 rounded border border-rose-700/50 text-rose-300 hover:bg-rose-950/40 transition"
      >
        QUIT ⏎
      </button>
    </header>
  );
}
