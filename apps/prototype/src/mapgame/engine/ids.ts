// Monotonic id minting for runtime objects (DPs, bourbons, niches). Prototype
// convenience — not part of the deterministic seed stream.

let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}
