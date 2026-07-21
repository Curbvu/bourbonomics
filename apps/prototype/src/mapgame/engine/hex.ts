// Axial hex math — shared by the engine (adjacency / contiguity) and the UI
// (pixel layout). Pointy-top orientation.

/** Axial hex coordinate. The canonical definition lives here. */
export interface Hex {
  q: number;
  r: number;
}

export const HEX_DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Hexes in ring/spiral order out from the center — a contiguous take-first-N list. */
export function hexSpiral(count: number): Hex[] {
  const out: Hex[] = [{ q: 0, r: 0 }];
  let radius = 1;
  while (out.length < count) {
    // walk the ring at this radius
    let h: Hex = { q: -radius, r: radius }; // start corner
    for (let side = 0; side < 6; side++) {
      const dir = HEX_DIRS[side]!;
      for (let step = 0; step < radius; step++) {
        out.push(h);
        h = { q: h.q + dir.q, r: h.r + dir.r };
        if (out.length >= count) break;
      }
      if (out.length >= count) break;
    }
    radius += 1;
    if (radius > 50) break; // safety
  }
  return out.slice(0, count);
}

/** Pointy-top axial → pixel center, given hex "size" (center-to-corner). */
export function axialToPixel(h: Hex, size: number): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (h.q + h.r / 2);
  const y = size * 1.5 * h.r;
  return { x, y };
}

/** SVG points string for a pointy-top hexagon centered at (cx, cy). */
export function hexPolygonPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}
