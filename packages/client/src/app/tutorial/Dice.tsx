"use client";

/**
 * Two visible dice that "fall, tumble, settle." Used by the time-skip
 * transition (Beat 4 + Beat 10) so the player sees the rolls happen,
 * even though the values are scripted.
 *
 * Pass `roll` to set the final faces; the dice pre-tumble for ~700ms,
 * then settle. Re-keying the wrapper (e.g. by index) restarts the
 * animation when a new roll fires within the same transition.
 */

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
};

export default function Dice({ values }: { values: [number, number] }) {
  const [a, b] = values;
  return (
    <div className="flex items-end justify-center gap-4">
      <Die value={a} />
      <Die value={b} />
      <style>{`
        @keyframes die-tumble-settle {
          0%   { transform: translateY(-90px) rotate(-180deg) scale(.92); opacity: 0; }
          30%  { transform: translateY(0)    rotate(20deg)  scale(1.04); opacity: 1; }
          50%  { transform: translateY(-12px) rotate(-10deg); }
          70%  { transform: translateY(0)    rotate(4deg);  }
          100% { transform: translateY(0)    rotate(0deg)   scale(1);    opacity: 1; }
        }
        .die-anim {
          animation: die-tumble-settle 900ms ease-out both;
        }
      `}</style>
    </div>
  );
}

function Die({ value }: { value: number }) {
  const v = Math.min(6, Math.max(1, value));
  const pips = PIPS[v]!;
  return (
    <div className="die-anim">
      <div
        className="grid h-[64px] w-[64px] grid-cols-3 grid-rows-3 gap-1 rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-200 p-2 shadow-[0_4px_18px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.7)]"
        aria-label={`Die showing ${v}`}
      >
        {[1, 2, 3].map((row) =>
          [1, 2, 3].map((col) => {
            const has = pips.some(([c, r]) => c === col && r === row);
            return (
              <div
                key={`${row}-${col}`}
                className={
                  has
                    ? "rounded-full bg-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,.6)]"
                    : "rounded-full bg-transparent"
                }
                aria-hidden
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
