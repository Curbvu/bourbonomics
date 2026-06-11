import type React from "react";

/**
 * Drag-and-drop protocol for building a barrel by dragging resource cards
 * from the hand onto an unbuilt rickhouse barrel. Mirrors the live game's
 * dragMake helper: a private MIME type carries the dragged card ids so a
 * barrel drop target can dispatch MAKE_BOURBON without touching click state.
 */
export const MAKE_DRAG_MIME = "application/x-bourbonomics-make-card";

/** Stamp the dragged resource-card ids onto a drag event. */
export function setMakeDragPayload(e: React.DragEvent, cardIds: string[]): void {
  if (cardIds.length === 0) return;
  e.dataTransfer.setData(MAKE_DRAG_MIME, JSON.stringify(cardIds));
  e.dataTransfer.setData("text/plain", cardIds.join(","));
  e.dataTransfer.effectAllowed = "move";
}

/** Read the dragged resource-card ids back off a drop event ([] if none). */
export function readMakeDragPayload(e: React.DragEvent): string[] {
  const raw = e.dataTransfer.getData(MAKE_DRAG_MIME);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    return [raw];
  }
  return [];
}

/** Whether an in-flight drag is carrying resource cards (checkable on dragover). */
export function dragCarriesMakeCard(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(MAKE_DRAG_MIME);
}
