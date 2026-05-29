// v3.2 — the v3.1 LineBoardDef / FlagshipLineBoardDef / LineCardDef
// types are removed. The Portfolio shape lives in src/types.ts and
// the catalog lives in src/lines/boards.ts (which still uses the
// `lines/` directory name as a transitional path).
//
// FLAGSHIP_SLOT_COUNT is preserved only as a hint constant; v3.2
// portfolios are 3–6 slots so callers shouldn't depend on it.

/** @deprecated v3.1 — v3.2 portfolios have variable slot counts (3–6). */
export const FLAGSHIP_SLOT_COUNT = 5;
