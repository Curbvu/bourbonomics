"use client";

/**
 * Long-form rulebook reader — the single allowed scrolling surface (see
 * CLAUDE.md rule 2). Renders the canonical GAME_RULES.md with a sticky
 * heading TOC. Ported from the live game's RulesViewer and re-themed onto
 * the cellar palette; isolated, no cross-imports.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TocEntry {
  id: string;
  depth: 1 | 2 | 3;
  text: string;
}

/** Slugify a heading the same way both the TOC builder and the
 *  ReactMarkdown heading renderer do — keeps the anchor stable. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
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

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    if (props?.children !== undefined) return extractText(props.children);
  }
  return "";
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

  const slugCounts = useRef(new Map<string, number>());
  slugCounts.current = new Map<string, number>();
  const claimSlug = (text: string): string => {
    const base = slugify(text);
    const n = slugCounts.current.get(base) ?? 0;
    slugCounts.current.set(base, n + 1);
    return n > 0 ? `${base}-${n}` : base;
  };

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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => {
                const id = claimSlug(extractText(children));
                return (
                  <h1
                    id={id}
                    className="mt-10 mb-4 scroll-mt-6 font-display text-4xl font-bold tracking-tight text-[var(--gold)] first:mt-0"
                  >
                    {children}
                  </h1>
                );
              },
              h2: ({ children }) => {
                const id = claimSlug(extractText(children));
                return (
                  <h2
                    id={id}
                    className="mt-9 mb-3 scroll-mt-6 font-display text-2xl font-semibold tracking-tight text-[var(--amber-2)]"
                  >
                    {children}
                  </h2>
                );
              },
              h3: ({ children }) => {
                const id = claimSlug(extractText(children));
                return (
                  <h3
                    id={id}
                    className="mt-7 mb-2 scroll-mt-6 font-display text-xl font-semibold text-[var(--amber)]"
                  >
                    {children}
                  </h3>
                );
              },
              h4: ({ children }) => (
                <h4 className="mt-5 mb-2 font-display text-lg font-semibold text-[var(--amber)]">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="my-3 leading-relaxed text-[var(--ink-muted)]">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="my-3 list-disc space-y-1 pl-6 text-[var(--ink-muted)]">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 list-decimal space-y-1 pl-6 text-[var(--ink-muted)]">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-[var(--ink)]">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic text-[var(--ink-muted)]">{children}</em>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  className="text-[var(--gold)] underline decoration-[var(--brass)]/50 underline-offset-2 hover:text-[var(--amber-2)]"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-4 border-l-4 border-[var(--brass)]/60 bg-[var(--panel)]/60 px-4 py-2 italic text-[var(--ink-muted)]">
                  {children}
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith("language-");
                if (isBlock) {
                  return (
                    <code className="block overflow-x-auto whitespace-pre rounded bg-[var(--panel)] p-3 font-mono text-[13px] text-[var(--amber-2)]">
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--amber-2)]">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="my-4 overflow-x-auto rounded-lg border border-[var(--rule)] bg-[var(--panel)]/80">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="my-5 overflow-x-auto rounded-lg border border-[var(--rule)]">
                  <table className="min-w-full divide-y divide-[var(--rule)] text-left text-[13px]">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[var(--panel)]/80">{children}</thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-[var(--rule)]/80">{children}</tbody>
              ),
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => (
                <th className="px-3 py-2 font-mono text-[12px] uppercase tracking-[.10em] text-[var(--gold)]">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 align-top text-[var(--ink-muted)]">
                  {children}
                </td>
              ),
              hr: () => <hr className="my-8 border-[var(--rule)]" />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
