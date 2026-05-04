"use client";

import { useEffect } from "react";

/** Dismiss a modal when the user hits Escape while it's open. */
export function useEscapeToClose(
  active: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [active, onClose]);
}
