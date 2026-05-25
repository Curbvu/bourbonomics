"use client";

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

/** Walk the markdown source line-by-line to assemble the TOC. We use
 *  this instead of crawling the rendered DOM so the sidebar can mount
 *  with the full list on first paint (no flicker). */
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

  // Track the heading currently in view. Uses an IntersectionObserver
  // anchored on the top quarter of the viewport so a section becomes
  // "active" as it scrolls under the page header.
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

  // Counters used to disambiguate repeated heading slugs the same way
  // the TOC builder does — so anchors stay in sync.
  const slugCounts = useRef(new Map<string, number>());
  // Reset between renders of new content.
  slugCounts.current = new Map<string, number>();
  const claimSlug = (text: string): string => {
    const base = slugify(text);
    const n = slugCounts.current.get(base) ?? 0;
    slugCounts.current.set(base, n + 1);
    return n > 0 ? `${base}-${n}` : base;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1180px] gap-10 px-6 py-10">
        {/* Sticky sidebar — heading-based TOC. */}
        <aside className="hidden w-[260px] flex-shrink-0 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-amber-400 hover:text-amber-300"
            >
              ← back to menu
            </Link>
            <div className="mb-3 font-mono text-[12px] uppercase tracking-[.16em] text-slate-500">
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
                            ? "bg-amber-700/25 text-amber-200"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-amber-200",
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
            className="mb-4 inline-flex items-center gap-1 font-mono text-[12px] text-amber-400 hover:text-amber-300"
          >
            ← back to menu
          </Link>
        </div>

        <div ref={contentRef} className="prose-rules min-w-0 flex-1">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => {
                const id = claimSlug(extractText(children));
                return (
                  <h1
                    id={id}
                    className="mt-10 mb-4 scroll-mt-6 font-display text-4xl font-bold tracking-tight text-amber-300 first:mt-0"
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
                    className="mt-9 mb-3 scroll-mt-6 font-display text-2xl font-semibold tracking-tight text-amber-200"
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
                    className="mt-7 mb-2 scroll-mt-6 font-display text-xl font-semibold text-amber-100"
                  >
                    {children}
                  </h3>
                );
              },
              h4: ({ children }) => (
                <h4 className="mt-5 mb-2 font-display text-lg font-semibold text-amber-100/90">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="my-3 leading-relaxed text-slate-200">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="my-3 list-disc space-y-1 pl-6 text-slate-200">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 list-decimal space-y-1 pl-6 text-slate-200">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-amber-100">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-slate-300">{children}</em>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  className="text-amber-400 underline decoration-amber-700/50 underline-offset-2 hover:text-amber-300"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-4 border-l-4 border-amber-700/60 bg-slate-900/60 px-4 py-2 italic text-slate-300">
                  {children}
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith("language-");
                if (isBlock) {
                  return (
                    <code className="block whitespace-pre overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[13px] text-amber-100">
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[12px] text-amber-200">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="my-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/80">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="my-5 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-[13px]">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-slate-900/80">{children}</thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-slate-800/80">{children}</tbody>
              ),
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => (
                <th className="px-3 py-2 font-mono text-[12px] uppercase tracking-[.10em] text-amber-300">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 align-top text-slate-200">{children}</td>
              ),
              hr: () => <hr className="my-8 border-slate-800" />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
