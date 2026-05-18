"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  defaultMashBillCatalog,
  type NewGameSettings,
} from "@bourbonomics/engine";
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

// v2.10 game settings — the right-side panel writes to this shape and
// the store reads it via `cfg.settings`. Three presets:
//   - "normal"  — full catalog, distilleries on, investments off.
//   - "bonded"  — Bottled in Bond (TBD recipe; placeholder smaller pool).
//   - "custom"  — user-edited. Toggling a control while a preset is
//                 selected snaps the panel to "custom".
type GamePreset = "normal" | "bonded" | "custom";

interface GameSettingsState extends Required<NewGameSettings> {
  preset: GamePreset;
}

// Pull the live catalog size at module load so the slider's upper bound
// always matches what the engine actually ships. (Defaults to 21 today;
// auto-tracks as the catalog grows.)
const CATALOG_SIZE = defaultMashBillCatalog().length;
const MIN_BILLS = 8;

// Preset definitions. `bonded` is a working placeholder — the user has
// flagged the exact recipe as TBD. For now it's a curated, half-size
// pool with distilleries on; once the rules are settled we'll tighten
// these numbers and probably constrain the catalog slice to specific
// bills.
const PRESETS: Record<Exclude<GamePreset, "custom">, NewGameSettings> = {
  normal: {
    mashBillCount: CATALOG_SIZE,
    distilleries: true,
    investments: false,
  },
  bonded: {
    mashBillCount: Math.max(MIN_BILLS, Math.floor(CATALOG_SIZE * 0.6)),
    distilleries: true,
    investments: false,
  },
};

function defaultSettings(): GameSettingsState {
  return {
    preset: "normal",
    mashBillCount: PRESETS.normal.mashBillCount!,
    distilleries: PRESETS.normal.distilleries!,
    investments: PRESETS.normal.investments!,
  };
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
  const [settings, setSettings] = useState<GameSettingsState>(defaultSettings);

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
      settings: {
        mashBillCount: settings.mashBillCount,
        distilleries: settings.distilleries,
        investments: settings.investments,
      },
    });
    router.push("/play");
  };

  // Settings helpers — every manual toggle marks the panel "custom".
  const applyPreset = (preset: Exclude<GamePreset, "custom">) => {
    const p = PRESETS[preset];
    setSettings({
      preset,
      mashBillCount: p.mashBillCount!,
      distilleries: p.distilleries!,
      investments: p.investments!,
    });
  };
  const patchSettings = (patch: Partial<Omit<GameSettingsState, "preset">>) => {
    setSettings((cur) => ({ ...cur, ...patch, preset: "custom" }));
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
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

      <SettingsPanel
        settings={settings}
        onPreset={applyPreset}
        onPatch={patchSettings}
      />
    </div>
  );
}

// ============================================================
// Settings panel — preset chooser + per-toggle controls
// ============================================================

function SettingsPanel({
  settings,
  onPreset,
  onPatch,
}: {
  settings: GameSettingsState;
  onPreset: (p: Exclude<GamePreset, "custom">) => void;
  onPatch: (patch: Partial<Omit<GameSettingsState, "preset">>) => void;
}) {
  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 lg:w-80 lg:flex-shrink-0">
      <h2 className="mb-1 font-display text-xl font-semibold">Settings</h2>
      <p className="mb-4 text-xs text-slate-500">
        Pick a preset or fine-tune the toggles below.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <PresetButton
          label="Normal"
          subtitle="The standard"
          active={settings.preset === "normal"}
          onClick={() => onPreset("normal")}
        />
        <PresetButton
          label="Bottled in Bond"
          subtitle="WIP · TBD"
          active={settings.preset === "bonded"}
          onClick={() => onPreset("bonded")}
        />
        <PresetButton
          label="Custom"
          subtitle="Your rules"
          active={settings.preset === "custom"}
          onClick={() => onPatch({})}
        />
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label
              htmlFor="setting-mash-bills"
              className="text-xs uppercase tracking-wide text-slate-400"
            >
              Mash bills in deck
            </label>
            <span className="font-mono text-sm tabular-nums text-amber-200">
              {settings.mashBillCount}
              <span className="ml-1 text-[10px] text-slate-500">/ {CATALOG_SIZE}</span>
            </span>
          </div>
          <input
            id="setting-mash-bills"
            type="range"
            min={MIN_BILLS}
            max={CATALOG_SIZE}
            step={1}
            value={settings.mashBillCount}
            onChange={(e) => onPatch({ mashBillCount: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Lower = shorter game. The deck running dry triggers the final round.
          </p>
        </div>

        <ToggleRow
          label="Distilleries"
          description="Pick an asymmetric distillery at setup. Off pre-assigns Vanilla to everyone."
          checked={settings.distilleries}
          onChange={(v) => onPatch({ distilleries: v })}
        />

        <ToggleRow
          label="Investments"
          description="Mint investment cards into the market."
          tag="preview"
          checked={settings.investments}
          onChange={(v) => onPatch({ investments: v })}
        />
      </div>
    </aside>
  );
}

function PresetButton({
  label,
  subtitle,
  active,
  onClick,
}: {
  label: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex flex-col items-start rounded-md border-2 px-2.5 py-2 text-left transition-colors",
        active
          ? "border-amber-400 bg-amber-500/15 text-amber-100 shadow-[0_0_0_2px_rgba(252,211,77,.25)]"
          : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100",
      ].join(" ")}
    >
      <span className="font-display text-[13px] font-bold leading-tight">{label}</span>
      <span
        className={[
          "mt-0.5 font-mono text-[9.5px] uppercase tracking-[.10em]",
          active ? "text-amber-300/90" : "text-slate-500",
        ].join(" ")}
      >
        {subtitle}
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  tag,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tag?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 hover:border-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 flex-shrink-0 accent-amber-500"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-sm font-semibold text-slate-100">{label}</span>
          {tag ? (
            <span className="rounded border border-amber-500/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[.10em] text-amber-300">
              {tag}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
          {description}
        </span>
      </span>
    </label>
  );
}
