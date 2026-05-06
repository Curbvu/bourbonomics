/**
 * Drag-and-drop wiring for "drag a hand card onto a barrel slot to
 * commit it" — a single-card MAKE_BOURBON shortcut that bypasses the
 * MakeOverlay picker.
 *
 * Hand cards (ResourceCard, CapitalCard in HandTray) are the drag
 * sources. Slot barrels (BarrelChip in RickhouseRow) in "ready" or
 * "construction" phase owned by the human are drop targets. On drop
 * the store dispatches MAKE_BOURBON with `cardIds: [cardId]`. The
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

export function setMakeDragPayload(e: React.DragEvent, cardId: string): void {
  e.dataTransfer.setData(MAKE_DRAG_MIME, cardId);
  // Also stash a plain-text fallback so external drop targets
  // (e.g. the URL bar) don't get a totally empty drag.
  e.dataTransfer.setData("text/plain", cardId);
  e.dataTransfer.effectAllowed = "move";
}

/**
 * Read the dragged card id back on the drop target. Returns null if
 * the drag didn't originate from a hand card (e.g. an unrelated text
 * drag), so the drop target can no-op cleanly.
 */
export function readMakeDragPayload(e: React.DragEvent): string | null {
  const id = e.dataTransfer.getData(MAKE_DRAG_MIME);
  return id ? id : null;
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
