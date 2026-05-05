/**
 * Bourbon "color grade" by age — purely cosmetic, used in the action
 * log so a barrel reads as "Aged to 3 yrs · amber" instead of just
 * "aged a barrel". Mirrors the rough real-world progression white →
 * straw → gold → amber → copper → mahogany → oak.
 */

export interface BourbonColor {
  /** Lower-case label shown inline in the action log. */
  name: string;
  /** Tailwind text class — same hue as the swatch the eye expects. */
  textClass: string;
}

const STAGES: { minAge: number; color: BourbonColor }[] = [
  { minAge: 7, color: { name: "oak",      textClass: "text-amber-700" } },
  { minAge: 5, color: { name: "mahogany", textClass: "text-amber-800" } },
  { minAge: 4, color: { name: "copper",   textClass: "text-orange-400" } },
  { minAge: 3, color: { name: "amber",    textClass: "text-amber-400" } },
  { minAge: 2, color: { name: "gold",     textClass: "text-yellow-300" } },
  { minAge: 1, color: { name: "straw",    textClass: "text-yellow-200" } },
  { minAge: 0, color: { name: "white",    textClass: "text-slate-200" } },
];

export function bourbonColor(age: number): BourbonColor {
  for (const s of STAGES) if (age >= s.minAge) return s.color;
  return STAGES[STAGES.length - 1]!.color;
}
