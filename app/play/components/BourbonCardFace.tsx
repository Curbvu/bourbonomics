"use client";

import type { BourbonCardDef } from "@/lib/catalogs/types";

type HighlightCell = {
  ageBand: 0 | 1 | 2;
  demandBand: 0 | 1 | 2;
};

const AGE_LABELS = ["2–3", "4–7", "8+"];
const DEMAND_LABELS = ["Low", "Mid", "High"];

/**
 * Readable rendering of a Bourbon Card's Market Price Guide. Pass `highlight` to
 * draw attention to a specific (ageBand, demandBand) cell — used during sale reveal.
 */
export default function BourbonCardFace({
  card,
  highlight,
  size = "md",
}: {
  card: BourbonCardDef;
  highlight?: HighlightCell;
  size?: "sm" | "md" | "lg";
}) {
  const cellSize = size === "lg" ? "h-12 w-16" : size === "sm" ? "h-7 w-10" : "h-10 w-12";
  const titleSize = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";
  return (
    <article
      className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-900/60 to-slate-950 p-3 shadow-lg"
      aria-label={`Bourbon card ${card.name}`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className={`font-semibold text-amber-100 ${titleSize}`}>{card.name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-amber-300/80">
          {card.rarity}
        </span>
      </header>
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Age
            </th>
            {DEMAND_LABELS.map((label, c) => (
              <th
                key={label}
                scope="col"
                className={`font-normal text-slate-400 ${highlight?.demandBand === c ? "text-amber-200" : ""}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.grid.map((row, r) => (
            <tr key={r}>
              <th
                scope="row"
                className={`pr-1 text-right font-normal text-slate-400 ${highlight?.ageBand === r ? "text-amber-200" : ""}`}
              >
                {AGE_LABELS[r]}
              </th>
              {row.map((price, c) => {
                const isHit =
                  highlight?.ageBand === r && highlight?.demandBand === c;
                return (
                  <td
                    key={c}
                    className={`rounded ${cellSize} align-middle font-semibold tabular-nums transition ${
                      isHit
                        ? "bg-amber-400 text-slate-950 ring-2 ring-amber-200"
                        : "bg-slate-900 text-slate-200"
                    }`}
                  >
                    ${price}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {card.awards ? (
        <footer className="mt-2 space-y-1 text-[10px] text-amber-200/80">
          {card.awards.silver ? (
            <div>
              <span className="font-semibold">Silver:</span> {card.awards.silver}
            </div>
          ) : null}
          {card.awards.gold ? (
            <div>
              <span className="font-semibold text-amber-300">Gold:</span>{" "}
              {card.awards.gold}
            </div>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
