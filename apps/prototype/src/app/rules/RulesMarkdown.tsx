"use client";

/**
 * Shared rulebook markdown renderer — the themed ReactMarkdown component map,
 * with stable heading ids (so the /rules TOC and the home-page anchor both
 * jump correctly). Used by RulesViewer (the dedicated page) and the home-page
 * inline "Game Rules" section.
 */

import { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Slugify a heading consistently for anchor ids. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
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

export default function RulesMarkdown({ markdown }: { markdown: string }) {
  // Heading ids are a pure function of the heading text (the rulebook has no
  // duplicate slugs), so server and client render identically — no mutable
  // render-time counter (which would mismatch under StrictMode hydration).
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 id={slugify(extractText(children))} className="mt-10 mb-4 scroll-mt-6 font-display text-4xl font-bold tracking-tight text-[var(--gold)] first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 id={slugify(extractText(children))} className="mt-9 mb-3 scroll-mt-6 font-display text-2xl font-semibold tracking-tight text-[var(--amber-2)]">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 id={slugify(extractText(children))} className="mt-7 mb-2 scroll-mt-6 font-display text-xl font-semibold text-[var(--amber)]">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-5 mb-2 font-display text-lg font-semibold text-[var(--amber)]">{children}</h4>
        ),
        p: ({ children }) => <p className="my-3 leading-relaxed text-[var(--ink-muted)]">{children}</p>,
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 text-[var(--ink-muted)]">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6 text-[var(--ink-muted)]">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--ink)]">{children}</strong>,
        em: ({ children }) => <em className="italic text-[var(--ink-muted)]">{children}</em>,
        a: ({ children, href }) => (
          <a href={href} className="text-[var(--gold)] underline decoration-[var(--brass)]/50 underline-offset-2 hover:text-[var(--amber-2)]">
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
          <pre className="my-4 overflow-x-auto rounded-lg border border-[var(--rule)] bg-[var(--panel)]/80">{children}</pre>
        ),
        table: ({ children }) => (
          <div className="my-5 overflow-x-auto rounded-lg border border-[var(--rule)]">
            <table className="min-w-full divide-y divide-[var(--rule)] text-left text-[13px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[var(--panel)]/80">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-[var(--rule)]/80">{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 font-mono text-[12px] uppercase tracking-[.10em] text-[var(--gold)]">{children}</th>
        ),
        td: ({ children }) => <td className="px-3 py-2 align-top text-[var(--ink-muted)]">{children}</td>,
        hr: () => <hr className="my-8 border-[var(--rule)]" />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
