import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rules — Bourbonomics",
};

export default function RulesPage() {
  const path = resolve(process.cwd(), "docs/GAME_RULES.md");
  const content = readFileSync(path, "utf8");

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl items-center gap-x-4">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Rules
          </span>
          <Link
            href="/"
            className="ml-auto text-sm text-slate-600 hover:underline dark:text-slate-300"
          >
            New game
          </Link>
          <Link
            href="/play"
            className="text-sm text-slate-600 hover:underline dark:text-slate-300"
          >
            Play
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="mb-6 text-sm text-amber-800 dark:text-amber-200">
          Source:{" "}
          <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">
            docs/GAME_RULES.md
          </code>
        </p>
        <article className="max-w-none whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 sm:text-sm">
          {content}
        </article>
      </div>
    </div>
  );
}
