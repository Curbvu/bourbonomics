"use client";

import type { ResourceCardDetails } from "@/lib/resource-card-ui";

function splitBoldSegments(text: string): Array<{ bold: boolean; text: string }> {
  const parts: Array<{ bold: boolean; text: string }> = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ bold: false, text: text.slice(last, m.index) });
    }
    parts.push({ bold: true, text: m[1] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ bold: false, text: text.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ bold: false, text });
  }
  return parts;
}

function engineBlurb(engine: string): string {
  const e = engine.toLowerCase();
  if (e === "modeled") {
    return "Prototype: this effect is modeled in the digital rules where applicable.";
  }
  if (e === "partial") {
    return "Prototype: partially modeled — some printed nuance may still be manual.";
  }
  if (e === "pending") {
    return "Prototype: not fully automated yet; use the printed rule when in doubt.";
  }
  return `Prototype engine tag: ${engine}.`;
}

type Props = {
  details: ResourceCardDetails;
  onClose: () => void;
};

export function ResourceCardDetailsModal({ details, onClose }: Props) {
  const ruleSegments = splitBoldSegments(details.rule);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-card-details-title"
      onClick={onClose}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        className="max-h-[min(85vh,560px)] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-900/40 bg-[#1a1410] p-5 text-amber-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              id="resource-card-details-title"
              className="font-serif text-xl font-semibold text-amber-100"
            >
              {details.title}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-amber-500/90">
              {details.tierLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-1 text-sm text-amber-200 hover:bg-amber-900/50"
          >
            Close
          </button>
        </div>
        {details.typePrinted ? (
          <p className="mt-2 text-xs text-amber-400/90">Printed type: {details.typePrinted}</p>
        ) : null}
        <p className="mt-3 text-sm italic text-amber-200/95">&ldquo;{details.hook}&rdquo;</p>
        <p className="mt-4 text-sm leading-relaxed text-amber-100/95">
          {ruleSegments.map((seg, i) =>
            seg.bold ? (
              <strong key={i} className="font-semibold text-amber-50">
                {seg.text}
              </strong>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
        {details.engine ? (
          <p className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300/95">
            {engineBlurb(details.engine)}
          </p>
        ) : null}
        <p className="mt-4 text-[11px] text-amber-500/80">
          Card id: <code className="text-amber-400/90">{details.id}</code>
        </p>
      </div>
    </div>
  );
}
