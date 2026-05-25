"use client";

/**
 * ToastStack — fixed top-right stack of transient notifications.
 *
 * Surfaces the store's `toasts` array. Pushed when the engine rejects
 * a local action (see dispatch catch in lib/store/game.tsx) or when
 * the multiplayer socket reports a server error. Each toast auto-
 * expires after ~4s via the store's prune ticker; clicking dismisses
 * immediately. Mounted at page root (outside ScalingHost) so it
 * anchors to the true viewport rather than the scaled design canvas.
 */

import { useGameStore } from "@/lib/store/game";

export default function ToastStack() {
  const { toasts, dismissToast } = useGameStore();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[320px] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={[
            "pointer-events-auto flex w-full flex-col items-start gap-0.5 rounded-md border-2 px-3.5 py-2.5 text-left shadow-[0_8px_28px_rgba(0,0,0,.55)] backdrop-blur-md animate-bb-tour-pop transition-colors",
            t.kind === "error"
              ? "border-rose-500/85 bg-gradient-to-b from-rose-900/85 to-slate-950/95 hover:border-rose-300"
              : "border-sky-500/85 bg-gradient-to-b from-sky-900/85 to-slate-950/95 hover:border-sky-300",
          ].join(" ")}
          aria-label={`${t.title}${t.detail ? `: ${t.detail}` : ""} — click to dismiss`}
        >
          <span
            className={`font-mono text-[12px] font-bold uppercase tracking-[.16em] ${
              t.kind === "error" ? "text-rose-200" : "text-sky-200"
            }`}
          >
            {t.kind === "error" ? "✕ " : "ⓘ "}
            {t.title}
          </span>
          {t.detail ? (
            <span className="font-display text-[13px] leading-snug text-slate-100">
              {t.detail}
            </span>
          ) : null}
          <span className="mt-0.5 font-mono text-[12px] uppercase tracking-[.14em] text-slate-500">
            click to dismiss
          </span>
        </button>
      ))}
    </div>
  );
}
