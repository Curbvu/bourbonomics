/**
 * Drag-and-drop wiring for "drag hand cards onto a barrel slot to
 * commit them" — a MAKE_BOURBON shortcut that bypasses the
 * MakeOverlay picker.
 *
 * v2.10: the payload now carries an ARRAY of card ids so the player
 * can left-click multiple hand cards (selection state in the store)
 * and drag the whole group onto a slot in a single drop. Single-card
 * drags still work — the array just has one entry.
 *
 * Hand cards (ResourceCard, CapitalCard in HandTray) are the drag
 * sources. Slot barrels (BarrelChip in RickhouseRow) in "ready" or
 * "construction" phase owned by the human are drop targets. On drop
 * the store dispatches MAKE_BOURBON with the full id list. The
 * engine's normal validation gates illegal commits (over-commit on
 * a recipe max, ingredient that the bill forbids, etc.).
 *
 * Single source of truth for the dataTransfer mime type and the
 * payload shape so the drag source and drop target agree on the
 * wire format without strings drifting.
 */

/**
 * Custom mime-like type so other DnD on the page (e.g. browser
 * default text/uri-list drags) can't be mistaken for a make-card
 * drop. Browsers normalise mime types to lowercase.
 */
export const MAKE_DRAG_MIME = "application/x-bourbonomics-make-card";

export function setMakeDragPayload(e: React.DragEvent, cardIds: string[]): void {
  if (cardIds.length === 0) return;
  e.dataTransfer.setData(MAKE_DRAG_MIME, JSON.stringify(cardIds));
  // Plain-text fallback so external drop targets (e.g. URL bar)
  // don't get a totally empty drag. Use the first id as a label.
  e.dataTransfer.setData("text/plain", cardIds.join(","));
  e.dataTransfer.effectAllowed = "move";
}

/**
 * Read the dragged card-id array back on the drop target. Returns an
 * empty array if the drag didn't originate from a hand card (e.g. an
 * unrelated text drag) so the drop target can no-op cleanly.
 */
export function readMakeDragPayload(e: React.DragEvent): string[] {
  const raw = e.dataTransfer.getData(MAKE_DRAG_MIME);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    // Pre-v2.10 single-id payload — fall back to treating as one id.
    return [raw];
  }
  return [];
}

/**
 * Tells whether the current drag carries a make-card payload. Used
 * by drop targets in `dragOver` to gate the `preventDefault()` (and
 * the visual highlight) so non-make drags don't activate the slot.
 *
 * Note: `getData(...)` is empty during dragover in most browsers for
 * security; we fall back to checking the registered mime list via
 * `types.includes(...)`.
 */
export function dragCarriesMakeCard(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(MAKE_DRAG_MIME);
}
