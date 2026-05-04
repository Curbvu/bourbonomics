"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useGameStore } from "@/lib/store/game";
import { PLAYER_LOGOS } from "@/app/play/components/playerLogos";
import {
  PLAYER_BG_CLASS,
  PLAYER_BORDER_CLASS,
  paletteIndex,
} from "@/app/play/components/playerColors";

type Difficulty = "easy" | "normal" | "hard";

const BOT_NAMES = ["Clyde", "Dell", "Mara", "Rix", "Ode"];

interface BotSeat {
  enabled: boolean;
  name: string;
  difficulty: Difficulty;
}

export default function NewGameForm() {
  const router = useRouter();
  const newGame = useGameStore().newGame;

  const [humanName, setHumanName] = useState("You");
  const [humanLogoId, setHumanLogoId] = useState(PLAYER_LOGOS[0]!.id);
  const [bots, setBots] = useState<BotSeat[]>([
    { enabled: true, name: BOT_NAMES[0]!, difficulty: "normal" },
    { enabled: true, name: BOT_NAMES[1]!, difficulty: "easy" },
    { enabled: false, name: BOT_NAMES[2]!, difficulty: "normal" },
    { enabled: false, name: BOT_NAMES[3]!, difficulty: "hard" },
    { enabled: false, name: BOT_NAMES[4]!, difficulty: "normal" },
  ]);
  const [seedInput, setSeedInput] = useState("");

  const enabledBots = bots.filter((b) => b.enabled);
  const totalSeats = 1 + enabledBots.length;
  const canStart = totalSeats >= 2 && totalSeats <= 6;

  // Bots take logos in order, skipping the human's pick.
  const remainingLogos = PLAYER_LOGOS.filter((l) => l.id !== humanLogoId);

  const start = () => {
    if (!canStart) return;
    const seed = seedInput
      ? Number(seedInput) >>> 0
      : Math.floor(Math.random() * 0xffff_ffff);
    newGame({
      seed,
      human: { name: humanName.trim() || "You", logoId: humanLogoId },
      bots: enabledBots.map((b, i) => ({
        name: b.name.trim() || "Bot",
        difficulty: b.difficulty,
        logoId:
          remainingLogos[i % remainingLogos.length]?.id ?? PLAYER_LOGOS[0]!.id,
      })),
    });
    router.push("/play");
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-4 font-display text-xl font-semibold">New game</h2>

      <div className="mb-5">
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
          Your name
        </label>
        <input
          type="text"
          value={humanName}
          onChange={(e) => setHumanName(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">
          Your logo
        </label>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {PLAYER_LOGOS.map((logo) => {
            const selected = logo.id === humanLogoId;
            const bgClass = PLAYER_BG_CLASS[paletteIndex(0)];
            const borderClass = PLAYER_BORDER_CLASS[paletteIndex(0)];
            return (
              <button
                key={logo.id}
                type="button"
                onClick={() => setHumanLogoId(logo.id)}
                title={`${logo.name} — ${logo.blurb}`}
                aria-pressed={selected}
                aria-label={logo.name}
                className={[
                  "grid h-11 w-11 place-items-center rounded-md border-2 text-2xl leading-none transition-all",
                  selected
                    ? `${bgClass} ${borderClass} text-white shadow-[0_0_0_3px_rgba(99,102,241,.30)]`
                    : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500",
                ].join(" ")}
              >
                {logo.glyph}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <h3 className="mb-2 text-xs uppercase tracking-wide text-slate-400">
          Opponents
        </h3>
        <div className="space-y-2">
          {bots.map((bot, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bot.enabled}
                  onChange={(e) =>
                    setBots((cur) =>
                      cur.map((b, i) =>
                        i === idx ? { ...b, enabled: e.target.checked } : b,
                      ),
                    )
                  }
                  className="h-4 w-4 accent-amber-500"
                />
                <input
                  type="text"
                  value={bot.name}
                  onChange={(e) =>
                    setBots((cur) =>
                      cur.map((b, i) =>
                        i === idx ? { ...b, name: e.target.value } : b,
                      ),
                    )
                  }
                  disabled={!bot.enabled}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm disabled:opacity-40"
                />
              </label>
              <select
                value={bot.difficulty}
                onChange={(e) =>
                  setBots((cur) =>
                    cur.map((b, i) =>
                      i === idx
                        ? {
                            ...b,
                            difficulty: e.target.value as Difficulty,
                          }
                        : b,
                    ),
                  )
                }
                disabled={!bot.enabled}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm disabled:opacity-40"
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Total barons: {totalSeats} (min 2, max 6) · Bots are auto-assigned
          unique logos.
        </p>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
          Seed (optional — leave blank for random)
        </label>
        <input
          type="number"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="e.g. 1234"
          className="w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={start}
        disabled={!canStart}
        className="rounded-md bg-amber-500 px-6 py-2 text-base font-semibold text-slate-950 transition hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
      >
        Start game
      </button>
    </section>
  );
}
