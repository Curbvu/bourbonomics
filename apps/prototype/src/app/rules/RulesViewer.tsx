"use client";

/**
 * Long-form rulebook reader — the single allowed scrolling surface (see
 * CLAUDE.md rule 2). Renders the canonical GAME_RULES.md with a sticky
 * heading TOC. The markdown body is the shared <RulesMarkdown>, also used by
 * the home-page inline rules section.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import RulesMarkdown, { slugify } from "./RulesMarkdown";

interface TocEntry {
  id: string;
  depth: 1 | 2 | 3;
  text: string;
}

/** Walk the markdown source line-by-line to assemble the TOC. */
function buildToc(markdown: string): TocEntry[] {
  const out: TocEntry[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const raw of markdown.split(/\r?\n/)) {
    if (raw.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (!m) continue;
    const hashes = m[1] ?? "";
    const heading = m[2] ?? "";
    const depth = hashes.length as 1 | 2 | 3;
    const text = heading.trim();
    let id = slugify(text);
    if (!id) continue;
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    out.push({ id, depth, text });
  }
  return out;
}

export default function RulesViewer({ markdown }: { markdown: string }) {
  const toc = useMemo(() => buildToc(markdown), [markdown]);
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Track the heading currently in view.
  useEffect(() => {
    if (!contentRef.current) return;
    const headings = contentRef.current.querySelectorAll<HTMLElement>(
      "h1[id], h2[id], h3[id]",
    );
    if (headings.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [markdown]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-[1180px] gap-10 px-6 py-10">
        {/* Sticky sidebar — heading-based TOC. */}
        <aside className="hidden w-[260px] flex-shrink-0 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-[var(--gold)] hover:text-[var(--amber-2)]"
            >
              ← back to menu
            </Link>
            <div className="mb-3 font-mono text-[12px] uppercase tracking-[.16em] text-[var(--mute)]">
              Contents
            </div>
            <nav>
              <ul className="space-y-0.5">
                {toc.map((entry) => {
                  const isActive = entry.id === activeId;
                  const indent =
                    entry.depth === 1 ? "" : entry.depth === 2 ? "pl-3" : "pl-6";
                  return (
                    <li key={entry.id}>
                      <a
                        href={`#${entry.id}`}
                        className={[
                          "block rounded px-2 py-1 leading-snug transition-colors",
                          indent,
                          entry.depth === 1
                            ? "font-display text-[14px] font-semibold"
                            : entry.depth === 2
                              ? "font-display text-[13px]"
                              : "font-mono text-[12px] tracking-[.04em]",
                          isActive
                            ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                            : "text-[var(--ink-muted)] hover:bg-[var(--panel)]/70 hover:text-[var(--amber-2)]",
                        ].join(" ")}
                      >
                        {entry.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Mobile back-link — sidebar is hidden under lg. */}
        <div className="lg:hidden">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-[var(--gold)] hover:text-[var(--amber-2)]"
          >
            ← back to menu
          </Link>
        </div>

        <div ref={contentRef} className="min-w-0 flex-1">
          <RulesMarkdown markdown={markdown} />
        </div>
      </div>
    </main>
  );
}
